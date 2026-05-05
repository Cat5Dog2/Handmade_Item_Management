import type {
  ProductDetailData,
  TaskCompletionData,
  TaskCompletionInput,
  TaskCreateData,
  TaskCreateInput,
  TaskDeleteData,
  TaskItem,
  TaskListData,
  TaskUpdateData,
  TaskUpdateInput
} from "@handmade/shared";
import {
  getProductPath,
  getProductTasksPath,
  getTaskCompletionPath,
  getTaskPath,
  taskCreateInputSchema
} from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "../api/api-client";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { getTaskFieldErrorMessage } from "../api/field-error-messages";
import { useApiClient } from "../api/api-client-context";
import { mapApiErrorToUi, type UiApiError } from "../api/map-api-error-to-ui";
import { queryKeys } from "../api/query-keys";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import { useZodForm } from "../forms/use-zod-form";
import {
  APP_NAME,
  PRODUCT_ERROR_MESSAGES,
  PRODUCT_ERROR_MESSAGE_OVERRIDES,
  PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES
} from "../messages/display-messages";
import {
  formatJstDate,
  formatJstMediumDateTime
} from "../utils/date-formatters";

interface PageNotice {
  message: string;
  type: "error" | "success";
}

interface TaskCompletionVariables {
  isCompleted: boolean;
  task: TaskItem;
}

type TaskFormMode = "create" | "edit" | "hidden";

const defaultTaskFormValues = {
  content: "",
  dueDate: "",
  memo: "",
  name: ""
};

function formatDate(value: string | null) {
  if (!value) {
    return "期限未設定";
  }

  return formatJstDate(`${value}T00:00:00+09:00`);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "未設定";
  }

  return formatJstMediumDateTime(value);
}

function updateTaskWithCompletion(
  task: TaskItem,
  completion: TaskCompletionData
): TaskItem {
  return {
    ...task,
    completedAt: completion.completedAt,
    isCompleted: completion.isCompleted,
    updatedAt: completion.updatedAt
  };
}

function updateTasksSummary(
  data: ProductDetailData | undefined,
  task: TaskItem,
  completion: TaskCompletionData
) {
  if (!data || task.isCompleted === completion.isCompleted) {
    return data;
  }

  const completedDelta = completion.isCompleted ? 1 : -1;
  const openDelta = completion.isCompleted ? -1 : 1;

  return {
    ...data,
    tasksSummary: {
      completedCount: Math.max(
        data.tasksSummary.completedCount + completedDelta,
        0
      ),
      openCount: Math.max(data.tasksSummary.openCount + openDelta, 0)
    }
  };
}

function TaskManagementCard({
  isBusy,
  isCompletionPending,
  onDeleteStart,
  onEditStart,
  onCompletionChange,
  task
}: {
  isBusy: boolean;
  isCompletionPending: boolean;
  onCompletionChange: (task: TaskItem, isCompleted: boolean) => void;
  onDeleteStart: (task: TaskItem) => void;
  onEditStart: (task: TaskItem) => void;
  task: TaskItem;
}) {
  return (
    <article
      className="management-card task-management-page__task-card"
      role="listitem"
    >
      <div className="management-card__header">
        <div>
          <p className="management-card__subtitle">
            {task.isCompleted ? "完了済み" : "未完了"}
          </p>
          <h3 className="management-card__title">{task.name}</h3>
        </div>
        <label className="task-management-page__task-toggle">
          <input
            aria-label={`${task.name}を${task.isCompleted ? "未完了に戻す" : "完了にする"}`}
            checked={task.isCompleted}
            disabled={isBusy || isCompletionPending}
            type="checkbox"
            onChange={(event) => {
              onCompletionChange(task, event.currentTarget.checked);
            }}
          />
          <span>{task.isCompleted ? "完了済み" : "未完了"}</span>
        </label>
      </div>
      <dl className="management-card__details">
        <div>
          <dt>期限</dt>
          <dd>{formatDate(task.dueDate)}</dd>
        </div>
        {task.isCompleted ? (
          <div>
            <dt>完了日時</dt>
            <dd>{formatDateTime(task.completedAt)}</dd>
          </div>
        ) : null}
        <div>
          <dt>更新日時</dt>
          <dd>{formatDateTime(task.updatedAt)}</dd>
        </div>
      </dl>
      {task.content.trim().length > 0 ? (
        <p className="task-management-page__task-content">{task.content}</p>
      ) : null}
      {task.memo.trim().length > 0 ? (
        <p className="task-management-page__task-memo">{task.memo}</p>
      ) : null}
      <div className="management-card__actions">
        <button
          className="secondary-button"
          disabled={isBusy}
          type="button"
          onClick={() => onEditStart(task)}
        >
          編集する
        </button>
        <button
          className="danger-button"
          disabled={isBusy}
          type="button"
          onClick={() => onDeleteStart(task)}
        >
          削除する
        </button>
      </div>
    </article>
  );
}

export function ProductTaskManagementPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { productId } = useParams();
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [formMode, setFormMode] = useState<TaskFormMode>("hidden");
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<TaskItem | null>(
    null
  );
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const taskForm = useZodForm(taskCreateInputSchema, {
    defaultValues: defaultTaskFormValues,
    mode: "onChange"
  });

  const productDetailQuery = useQuery({
    enabled: Boolean(productId),
    queryKey: productId
      ? queryKeys.products.detail(productId)
      : ["products", "detail", "missing"],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<ProductDetailData>(
        getProductPath(productId ?? ""),
        {
          signal
        }
      );

      return response.data;
    }
  });

  const taskListQuery = useQuery({
    enabled: Boolean(productId && productDetailQuery.data),
    queryKey: productId
      ? queryKeys.products.tasks(productId, {
          showCompleted: showCompletedTasks
        })
      : ["products", "tasks", "missing"],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<TaskListData>(
        getProductTasksPath(productId ?? ""),
        {
          query: {
            showCompleted: showCompletedTasks
          },
          signal
        }
      );

      return response.data;
    }
  });

  const refreshTaskData = useCallback(async () => {
    if (!productId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["products", "tasks", productId]
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(productId)
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.root
      })
    ]);
  }, [productId, queryClient]);

  const resetTaskForm = useCallback(() => {
    setEditingTask(null);
    setFormMode("hidden");
    taskForm.clearErrors();
    taskForm.reset(defaultTaskFormValues);
  }, [taskForm]);

  const applyFormApiErrors = useCallback(
    (error: UiApiError) => {
      if (error.code !== "VALIDATION_ERROR") {
        return false;
      }

      let applied = false;

      error.details.forEach((detail) => {
        if (
          detail.field === "content" ||
          detail.field === "dueDate" ||
          detail.field === "memo" ||
          detail.field === "name"
        ) {
          taskForm.setError(detail.field, {
            message: getTaskFieldErrorMessage(detail.field, detail.message),
            type: "server"
          });
          applied = true;
        }
      });

      return applied;
    },
    [taskForm]
  );

  const createTaskMutation = useMutation({
    mutationFn: async (input: TaskCreateInput) => {
      const response = await apiClient.post<
        TaskCreateData,
        undefined,
        TaskCreateInput
      >(getProductTasksPath(productId ?? ""), {
        body: input
      });

      return response.data;
    },
    onSuccess: refreshTaskData
  });

  const updateTaskCompletionMutation = useMutation({
    mutationFn: async ({ isCompleted, task }: TaskCompletionVariables) => {
      const response = await apiClient.patch<
        TaskCompletionData,
        undefined,
        TaskCompletionInput
      >(getTaskCompletionPath(task.taskId), {
        body: {
          isCompleted
        }
      });

      return response.data;
    },
    onSuccess: async (data, variables) => {
      if (!productId) {
        return;
      }

      queryClient.setQueryData<TaskListData>(
        queryKeys.products.tasks(productId, {
          showCompleted: showCompletedTasks
        }),
        (current) => {
          if (!current) {
            return current;
          }

          const nextItems = current.items.map((task) =>
            task.taskId === data.taskId
              ? updateTaskWithCompletion(task, data)
              : task
          );

          return {
            ...current,
            items: showCompletedTasks
              ? nextItems
              : nextItems.filter((task) => !task.isCompleted)
          };
        }
      );
      queryClient.setQueryData<ProductDetailData>(
        queryKeys.products.detail(productId),
        (current) => updateTasksSummary(current, variables.task, data)
      );
      setEditingTask((current) =>
        current?.taskId === data.taskId
          ? updateTaskWithCompletion(current, data)
          : current
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.root
      });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      input,
      task
    }: {
      input: TaskCreateInput;
      task: TaskItem;
    }) => {
      const updateInput: TaskUpdateInput = {
        ...input,
        isCompleted: task.isCompleted
      };
      const response = await apiClient.put<
        TaskUpdateData,
        undefined,
        TaskUpdateInput
      >(getTaskPath(task.taskId), {
        body: updateInput
      });

      return response.data;
    },
    onSuccess: refreshTaskData
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiClient.delete<TaskDeleteData>(
        getTaskPath(taskId)
      );

      return response.data;
    },
    onSuccess: refreshTaskData
  });

  if (!productId) {
    return (
      <section
        className="management-page task-management-page"
        aria-labelledby="task-management-title"
      >
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="task-management-title">タスク管理</h1>
          <p className="management-page__lead">
            商品に紐づく作業と期限を確認します。
          </p>
        </div>
        <ScreenErrorState message={PRODUCT_ERROR_MESSAGES.notFound} />
      </section>
    );
  }

  const handleRetry = () => {
    setNotice(null);

    if (productDetailQuery.isError) {
      void productDetailQuery.refetch();
      return;
    }

    void taskListQuery.refetch();
  };

  const handleCreateStart = () => {
    setNotice(null);
    setEditingTask(null);
    setFormMode("create");
    taskForm.clearErrors();
    taskForm.reset(defaultTaskFormValues);
  };

  const handleEditStart = (task: TaskItem) => {
    setNotice(null);
    setEditingTask(task);
    setFormMode("edit");
    taskForm.clearErrors();
    taskForm.reset({
      content: task.content,
      dueDate: task.dueDate ?? "",
      memo: task.memo,
      name: task.name
    });
  };

  const handleTaskSubmit = taskForm.handleSubmit(async (values) => {
    setNotice(null);
    taskForm.clearErrors();

    if (formMode === "edit") {
      if (!editingTask) {
        setNotice({
          message: PRODUCT_ERROR_MESSAGES.taskNotFound,
          type: "error"
        });
        return;
      }

      try {
        await updateTaskMutation.mutateAsync({
          input: values,
          task: editingTask
        });
        resetTaskForm();
        setNotice({
          message: "タスクを更新しました。",
          type: "success"
        });
      } catch (error) {
        const uiError = mapApiErrorToUi(error, {
          codeMessages: PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES,
          fallbackMessage: PRODUCT_ERROR_MESSAGES.taskUpdateFailed
        });
        const hasFieldError = applyFormApiErrors(uiError);

        if (uiError.code === "TASK_NOT_FOUND") {
          resetTaskForm();
          await refreshTaskData();
        }

        if (!hasFieldError) {
          setNotice({
            message: uiError.message,
            type: "error"
          });
        }
      }

      return;
    }

    try {
      await createTaskMutation.mutateAsync(values);
      resetTaskForm();
      setNotice({
        message: "タスクを追加しました。",
        type: "success"
      });
    } catch (error) {
      const uiError = mapApiErrorToUi(error, {
        codeMessages: PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES,
        fallbackMessage: PRODUCT_ERROR_MESSAGES.taskCreateFailed
      });
      const hasFieldError = applyFormApiErrors(uiError);

      if (!hasFieldError) {
        setNotice({
          message: uiError.message,
          type: "error"
        });
      }
    }
  });

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteTask) {
      return;
    }

    const taskToDelete = pendingDeleteTask;

    setNotice(null);

    try {
      await deleteTaskMutation.mutateAsync(taskToDelete.taskId);
      setPendingDeleteTask(null);

      if (editingTask?.taskId === taskToDelete.taskId) {
        resetTaskForm();
      }

      setNotice({
        message: "タスクを削除しました。",
        type: "success"
      });
    } catch (error) {
      setPendingDeleteTask(null);

      if (error instanceof ApiClientError && error.code === "TASK_NOT_FOUND") {
        if (editingTask?.taskId === taskToDelete.taskId) {
          resetTaskForm();
        }

        await refreshTaskData();
      }

      const uiError = mapApiErrorToUi(error, {
        codeMessages: PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES,
        fallbackMessage: PRODUCT_ERROR_MESSAGES.taskDeleteFailed
      });

      setNotice({
        message: uiError.message,
        type: "error"
      });
    }
  };

  const handleTaskCompletionChange = async (
    task: TaskItem,
    isCompleted: boolean
  ) => {
    setNotice(null);

    try {
      await updateTaskCompletionMutation.mutateAsync({
        isCompleted,
        task
      });
    } catch (error) {
      const uiError = mapApiErrorToUi(error, {
        codeMessages: PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES,
        fallbackMessage: PRODUCT_ERROR_MESSAGES.taskCompletionFailed
      });

      setNotice({
        message: uiError.message,
        type: "error"
      });
    }
  };

  const isInitialLoading =
    productDetailQuery.isPending ||
    (Boolean(productDetailQuery.data) && taskListQuery.isPending);

  if (isInitialLoading) {
    return (
      <section
        className="management-page task-management-page"
        aria-labelledby="task-management-title"
      >
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="task-management-title">タスク管理</h1>
          <p className="management-page__lead">
            商品に紐づく作業と期限を確認します。
          </p>
        </div>
        <ScreenLoadingState message="タスク情報を読み込んでいます..." />
      </section>
    );
  }

  if (productDetailQuery.isError || !productDetailQuery.data) {
    return (
      <section
        className="management-page task-management-page"
        aria-labelledby="task-management-title"
      >
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="task-management-title">タスク管理</h1>
          <p className="management-page__lead">
            商品に紐づく作業と期限を確認します。
          </p>
        </div>
        <ScreenErrorState
          message={getApiErrorDisplayMessage(productDetailQuery.error, {
            codeMessages: PRODUCT_ERROR_MESSAGE_OVERRIDES,
            fallbackMessage: PRODUCT_ERROR_MESSAGES.detailFetchFailed
          })}
          onRetry={handleRetry}
        />
      </section>
    );
  }

  const { product, tasksSummary } = productDetailQuery.data;
  const taskItems = taskListQuery.data?.items ?? [];
  const isPageBusy =
    productDetailQuery.isFetching ||
    taskListQuery.isFetching ||
    createTaskMutation.isPending ||
    updateTaskMutation.isPending ||
    deleteTaskMutation.isPending ||
    updateTaskCompletionMutation.isPending;
  const formErrors = taskForm.formState.errors;
  const pendingCompletionTaskId = updateTaskCompletionMutation.isPending
    ? updateTaskCompletionMutation.variables?.task.taskId
    : null;
  const taskEmptyMessage = showCompletedTasks
    ? "タスクはまだありません。必要な作業を追加してください。"
    : "未完了のタスクはありません。";

  return (
    <section
      className="management-page task-management-page"
      aria-labelledby="task-management-title"
    >
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div className="task-management-page__header-row">
          <div>
            <p className="task-management-page__product-id">
              {product.productId}
            </p>
            <h1 id="task-management-title">{product.name}のタスク管理</h1>
            <p className="management-page__lead">
              商品に紐づく作業と期限を確認します。
            </p>
          </div>
          <Link
            className="secondary-button button-link"
            to={`/products/${product.productId}`}
          >
            商品詳細へ
          </Link>
        </div>
        {productDetailQuery.isFetching || taskListQuery.isFetching ? (
          <p className="management-page__sync" role="status">
            最新のタスク情報を更新中です...
          </p>
        ) : null}
        {notice ? (
          <div
            className={
              notice.type === "success"
                ? "management-page__notice is-success"
                : "management-page__notice is-error"
            }
            role={notice.type === "success" ? "status" : "alert"}
          >
            <p>{notice.message}</p>
          </div>
        ) : null}
      </div>

      <section
        className="management-page__section"
        aria-labelledby="task-list-title"
      >
        <div className="management-page__section-header">
          <div>
            <h2 id="task-list-title" className="management-page__section-title">
              タスク一覧
            </h2>
            <p className="management-page__section-summary">
              未完了タスクを期限が近い順に表示します。
            </p>
          </div>
          <button
            className="primary-button"
            disabled={isPageBusy}
            type="button"
            onClick={handleCreateStart}
          >
            タスクを追加
          </button>
        </div>
        <div className="task-management-page__summary" role="status">
          <span>{`未完了 ${tasksSummary.openCount}件`}</span>
          <span>{`完了 ${tasksSummary.completedCount}件`}</span>
        </div>
        <div className="task-management-page__toolbar">
          <label className="task-management-page__completed-toggle">
            <input
              checked={showCompletedTasks}
              disabled={
                taskListQuery.isFetching ||
                updateTaskCompletionMutation.isPending
              }
              type="checkbox"
              onChange={(event) => {
                setNotice(null);
                setShowCompletedTasks(event.currentTarget.checked);
              }}
            />
            <span>完了済みも表示</span>
          </label>
          <p className="management-form__hint">
            商品詳細では簡易切替、この画面では登録・編集・削除までまとめて管理します。
          </p>
        </div>
        {taskListQuery.isError ? (
          <ScreenErrorState
            message={getApiErrorDisplayMessage(taskListQuery.error, {
              codeMessages: PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES,
              fallbackMessage: PRODUCT_ERROR_MESSAGES.tasksFetchFailed
            })}
            onRetry={handleRetry}
          />
        ) : taskItems.length === 0 ? (
          <ScreenEmptyState message={taskEmptyMessage} />
        ) : (
          <div
            className="management-list task-management-page__task-list"
            role="list"
          >
            {taskItems.map((task) => (
              <TaskManagementCard
                key={task.taskId}
                isBusy={isPageBusy}
                isCompletionPending={pendingCompletionTaskId === task.taskId}
                task={task}
                onCompletionChange={handleTaskCompletionChange}
                onDeleteStart={setPendingDeleteTask}
                onEditStart={handleEditStart}
              />
            ))}
          </div>
        )}
      </section>

      {formMode !== "hidden" ? (
        <section
          className="management-page__section"
          aria-labelledby="task-form-title"
        >
          <div className="management-page__section-header">
            <div>
              <h2
                id="task-form-title"
                className="management-page__section-title"
              >
                {formMode === "edit" ? "タスク編集" : "タスク追加"}
              </h2>
              <p className="management-page__section-summary">
                タスク名、内容、納期、メモを保存します。
              </p>
            </div>
          </div>
          <form
            className="management-form task-management-page__form"
            noValidate
            onSubmit={handleTaskSubmit}
          >
            <div className="management-form__grid">
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="task-name">
                  タスク名
                </label>
                <input
                  {...taskForm.register("name")}
                  id="task-name"
                  aria-invalid={Boolean(formErrors.name)}
                  className="auth-field__input"
                  disabled={isPageBusy}
                  type="text"
                />
                {formErrors.name ? (
                  <p className="auth-field__error" role="alert">
                    {getTaskFieldErrorMessage("name", formErrors.name.message)}
                  </p>
                ) : null}
              </div>
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="task-due-date">
                  納期
                </label>
                <input
                  {...taskForm.register("dueDate")}
                  id="task-due-date"
                  aria-invalid={Boolean(formErrors.dueDate)}
                  className="auth-field__input"
                  disabled={isPageBusy}
                  type="date"
                />
                {formErrors.dueDate ? (
                  <p className="auth-field__error" role="alert">
                    {getTaskFieldErrorMessage(
                      "dueDate",
                      formErrors.dueDate.message
                    )}
                  </p>
                ) : null}
              </div>
              <div className="auth-field task-management-page__content-field">
                <label className="auth-field__label" htmlFor="task-content">
                  タスク内容
                </label>
                <textarea
                  {...taskForm.register("content")}
                  id="task-content"
                  aria-invalid={Boolean(formErrors.content)}
                  className="auth-field__input task-management-page__textarea"
                  disabled={isPageBusy}
                  rows={5}
                />
                {formErrors.content ? (
                  <p className="auth-field__error" role="alert">
                    {getTaskFieldErrorMessage(
                      "content",
                      formErrors.content.message
                    )}
                  </p>
                ) : null}
              </div>
              <div className="auth-field task-management-page__memo-field">
                <label className="auth-field__label" htmlFor="task-memo">
                  メモ
                </label>
                <textarea
                  {...taskForm.register("memo")}
                  id="task-memo"
                  aria-invalid={Boolean(formErrors.memo)}
                  className="auth-field__input task-management-page__textarea"
                  disabled={isPageBusy}
                  rows={4}
                />
                {formErrors.memo ? (
                  <p className="auth-field__error" role="alert">
                    {getTaskFieldErrorMessage("memo", formErrors.memo.message)}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="management-form__actions">
              <button
                className="primary-button"
                disabled={!taskForm.formState.isValid || isPageBusy}
                type="submit"
              >
                {formMode === "edit" ? "更新する" : "追加する"}
              </button>
              <button
                className="secondary-button"
                disabled={isPageBusy}
                type="button"
                onClick={resetTaskForm}
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {pendingDeleteTask ? (
        <div className="app-dialog__backdrop" role="presentation">
          <section
            aria-labelledby="task-delete-title"
            aria-modal="true"
            className="app-dialog"
            role="dialog"
          >
            <h2 id="task-delete-title">タスク削除確認</h2>
            <p className="app-dialog__summary">
              「{pendingDeleteTask.name}」を削除しますか？
              削除したタスクは元に戻せません。
            </p>
            <div className="app-dialog__actions">
              <button
                className="secondary-button"
                disabled={deleteTaskMutation.isPending}
                type="button"
                onClick={() => setPendingDeleteTask(null)}
              >
                キャンセル
              </button>
              <button
                className="danger-button"
                disabled={deleteTaskMutation.isPending}
                type="button"
                onClick={() => {
                  void handleDeleteConfirm();
                }}
              >
                削除する
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
