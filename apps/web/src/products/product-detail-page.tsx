import type {
  ProductDeleteData,
  ProductDetailData,
  ProductImageDetail,
  ProductStatus,
  TaskCompletionData,
  TaskCompletionInput,
  TaskItem,
  TaskListData
} from "@handmade/shared";
import {
  getProductPath,
  getProductTasksPath,
  getTaskCompletionPath,
  PRODUCT_STATUS_LABELS
} from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toString as generateQRCodeSvg } from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
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
  showCompleted: boolean;
  task: TaskItem;
}

const priceFormatter = new Intl.NumberFormat("ja-JP", {
  currency: "JPY",
  style: "currency"
});

const productStatusBadgeClassNames: Record<ProductStatus, string> = {
  beforeProduction: "product-status-badge is-before-production",
  completed: "product-status-badge is-completed",
  inProduction: "product-status-badge is-in-production",
  inStock: "product-status-badge is-in-stock",
  onDisplay: "product-status-badge is-on-display",
  sold: "product-status-badge is-sold"
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

function formatPrice(price: number) {
  return priceFormatter.format(price);
}

function formatOptionalText(
  value: string | null | undefined,
  fallback = "未設定"
) {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value;
}

function selectPrimaryImage(images: ProductImageDetail[]) {
  return (
    images.find((image) => image.isPrimary) ??
    [...images].sort((left, right) => left.sortOrder - right.sortOrder)[0] ??
    null
  );
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

function ProductTaskCard({
  isCompletionPending,
  onCompletionChange,
  task
}: {
  isCompletionPending: boolean;
  onCompletionChange: (task: TaskItem, isCompleted: boolean) => void;
  task: TaskItem;
}) {
  return (
    <article
      className="management-card product-detail-page__task-card"
      role="listitem"
    >
      <div className="management-card__header">
        <div>
          <p className="management-card__subtitle">
            {task.isCompleted ? "完了済み" : "未完了"}
          </p>
          <h3 className="management-card__title">{task.name}</h3>
        </div>
        <label className="product-detail-page__task-toggle">
          <input
            aria-label={`${task.name}を${task.isCompleted ? "未完了に戻す" : "完了にする"}`}
            checked={task.isCompleted}
            disabled={isCompletionPending}
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
        <p className="product-detail-page__task-content">{task.content}</p>
      ) : null}
    </article>
  );
}

function ProductImagePreview({
  image,
  name
}: {
  image: ProductImageDetail | null;
  name: string;
}) {
  return (
    <div className="product-detail-page__image">
      {image ? (
        <img
          alt={name}
          className="product-detail-page__image-element"
          src={image.displayUrl}
        />
      ) : (
        <div className="product-detail-page__image-placeholder">
          画像は登録されていません
        </div>
      )}
    </div>
  );
}

export function ProductDetailPage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { productId } = useParams();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

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

  const deleteProductMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<ProductDeleteData>(
        getProductPath(productId ?? "")
      );

      return response.data;
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.root
        }),
        queryClient.invalidateQueries({
          queryKey: ["products", "list"]
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(data.productId)
        }),
        queryClient.invalidateQueries({
          queryKey: ["products", "tasks", data.productId]
        })
      ]);
    }
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
    onSuccess: (data, variables) => {
      if (!productId) {
        return;
      }

      queryClient.setQueryData<TaskListData>(
        queryKeys.products.tasks(productId, {
          showCompleted: variables.showCompleted
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
            items: variables.showCompleted
              ? nextItems
              : nextItems.filter((task) => !task.isCompleted)
          };
        }
      );
      queryClient.setQueryData<ProductDetailData>(
        queryKeys.products.detail(productId),
        (current) => updateTasksSummary(current, variables.task, data)
      );
    }
  });

  const qrCodeValue = productDetailQuery.data?.qrCodeValue ?? "";

  useEffect(() => {
    if (!qrCodeValue) {
      setQrSvg(null);
      setQrError(false);
      return;
    }

    let isCurrent = true;
    setQrSvg(null);
    setQrError(false);

    void generateQRCodeSvg(qrCodeValue, {
      errorCorrectionLevel: "M",
      margin: 2,
      type: "svg",
      width: 192
    })
      .then((svg) => {
        if (isCurrent) {
          setQrSvg(svg);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setQrError(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [qrCodeValue]);

  const primaryImage = useMemo(
    () => selectPrimaryImage(productDetailQuery.data?.images ?? []),
    [productDetailQuery.data?.images]
  );

  if (!productId) {
    return (
      <section
        className="management-page product-detail-page"
        aria-labelledby="product-detail-title"
      >
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="product-detail-title">商品詳細</h1>
          <p className="management-page__lead">
            商品情報とQRコードを確認します。
          </p>
        </div>
        <ScreenErrorState message={PRODUCT_ERROR_MESSAGES.notFound} />
      </section>
    );
  }

  const handleRetry = () => {
    setNotice(null);
    void productDetailQuery.refetch();
  };

  const handleTaskRetry = () => {
    setNotice(null);
    void taskListQuery.refetch();
  };

  const handleDeleteConfirm = async () => {
    setNotice(null);

    try {
      await deleteProductMutation.mutateAsync();
      navigate("/products", {
        replace: true,
        state: {
          notice: {
            message: "商品を削除しました。",
            type: "success"
          } satisfies PageNotice
        }
      });
    } catch (error) {
      setIsDeleteDialogOpen(false);
      setNotice({
        message: getApiErrorDisplayMessage(error, {
          codeMessages: PRODUCT_ERROR_MESSAGE_OVERRIDES,
          fallbackMessage: PRODUCT_ERROR_MESSAGES.deleteFailed
        }),
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
        showCompleted: showCompletedTasks,
        task
      });
    } catch (error) {
      setNotice({
        message: getApiErrorDisplayMessage(error, {
          codeMessages: PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES,
          fallbackMessage: PRODUCT_ERROR_MESSAGES.taskCompletionFailed
        }),
        type: "error"
      });
    }
  };

  const handleQrPrint = () => {
    window.print();
  };

  if (productDetailQuery.isPending) {
    return (
      <section
        className="management-page product-detail-page"
        aria-labelledby="product-detail-title"
      >
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="product-detail-title">商品詳細</h1>
          <p className="management-page__lead">
            商品情報とQRコードを確認します。
          </p>
        </div>
        <ScreenLoadingState message="商品詳細を読み込んでいます..." />
      </section>
    );
  }

  if (productDetailQuery.isError || !productDetailQuery.data) {
    return (
      <section
        className="management-page product-detail-page"
        aria-labelledby="product-detail-title"
      >
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="product-detail-title">商品詳細</h1>
          <p className="management-page__lead">
            商品情報とQRコードを確認します。
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

  const { images, product, tasksSummary } = productDetailQuery.data;
  const tagText =
    product.tagNames.length > 0 ? product.tagNames.join(", ") : "タグなし";
  const taskItems = taskListQuery.data?.items ?? [];
  const pendingTaskId = updateTaskCompletionMutation.isPending
    ? updateTaskCompletionMutation.variables?.task.taskId
    : null;
  const shouldShowCustomerLink =
    product.status === "sold" && Boolean(product.soldCustomerId);
  const isPageBusy =
    productDetailQuery.isFetching ||
    deleteProductMutation.isPending ||
    updateTaskCompletionMutation.isPending;
  const taskEmptyMessage = showCompletedTasks
    ? "関連タスクはまだありません。タスク管理から追加してください。"
    : "未完了の関連タスクはありません。";

  return (
    <section
      className="management-page product-detail-page"
      aria-labelledby="product-detail-title"
    >
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div className="product-detail-page__header-row">
          <div>
            <p className="product-detail-page__product-id">
              {product.productId}
            </p>
            <h1 id="product-detail-title">{product.name}</h1>
            <p className="management-page__lead">
              商品情報とQRコードを確認します。
            </p>
          </div>
          <div className="product-detail-page__action-row">
            <Link
              className="secondary-button button-link"
              to={`/products/${product.productId}/edit`}
            >
              編集する
            </Link>
            <Link
              className="secondary-button button-link"
              to={`/products/${product.productId}/tasks`}
            >
              タスクを見る
            </Link>
            <button
              className="danger-button"
              disabled={isPageBusy}
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              削除する
            </button>
          </div>
        </div>
        {productDetailQuery.isFetching ? (
          <p className="management-page__sync" role="status">
            最新の商品詳細を更新中です...
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
        aria-labelledby="product-basic-title"
      >
        <div className="management-page__section-header">
          <div>
            <h2
              id="product-basic-title"
              className="management-page__section-title"
            >
              基本情報
            </h2>
            <p className="management-page__section-summary">
              商品の状態、分類、価格、更新日時を確認します。
            </p>
          </div>
          <span className={productStatusBadgeClassNames[product.status]}>
            {PRODUCT_STATUS_LABELS[product.status]}
          </span>
        </div>
        <article className="management-card product-detail-page__overview">
          <ProductImagePreview image={primaryImage} name={product.name} />
          <div className="product-detail-page__summary">
            <dl className="management-card__details product-detail-page__details">
              <div>
                <dt>商品ID</dt>
                <dd>{product.productId}</dd>
              </div>
              <div>
                <dt>価格</dt>
                <dd>{formatPrice(product.price)}</dd>
              </div>
              <div>
                <dt>カテゴリ</dt>
                <dd>{product.categoryName}</dd>
              </div>
              <div>
                <dt>タグ</dt>
                <dd>{tagText}</dd>
              </div>
              <div>
                <dt>登録日時</dt>
                <dd>{formatDateTime(product.createdAt)}</dd>
              </div>
              <div>
                <dt>更新日時</dt>
                <dd>{formatDateTime(product.updatedAt)}</dd>
              </div>
              {product.status === "sold" ? (
                <div>
                  <dt>販売日時</dt>
                  <dd>{formatDateTime(product.soldAt)}</dd>
                </div>
              ) : null}
              {shouldShowCustomerLink ? (
                <div>
                  <dt>購入者情報</dt>
                  <dd>
                    <Link
                      className="product-detail-page__inline-link"
                      to={`/customers/${product.soldCustomerId}`}
                    >
                      {formatOptionalText(
                        product.soldCustomerNameSnapshot,
                        "購入者名未設定"
                      )}
                    </Link>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>画像枚数</dt>
                <dd>{`${images.length}枚`}</dd>
              </div>
              <div>
                <dt>未完了タスク</dt>
                <dd>{`${tasksSummary.openCount}件`}</dd>
              </div>
            </dl>
            <div className="product-detail-page__description-block">
              <h3 className="product-detail-page__subheading">説明</h3>
              <p className="product-detail-page__description">
                {formatOptionalText(product.description, "説明はありません。")}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section
        className="management-page__section"
        aria-labelledby="product-tasks-title"
      >
        <div className="management-page__section-header">
          <div>
            <h2
              id="product-tasks-title"
              className="management-page__section-title"
            >
              関連タスク
            </h2>
            <p className="management-page__section-summary">
              未完了タスクを優先して確認します。
            </p>
          </div>
          <Link
            className="secondary-button button-link"
            to={`/products/${product.productId}/tasks`}
          >
            タスク管理へ
          </Link>
        </div>
        <div className="product-detail-page__task-summary" role="status">
          <span>{`未完了 ${tasksSummary.openCount}件`}</span>
          <span>{`完了 ${tasksSummary.completedCount}件`}</span>
        </div>
        <div className="product-detail-page__task-toolbar">
          <label className="product-detail-page__completed-toggle">
            <input
              checked={showCompletedTasks}
              disabled={
                taskListQuery.isFetching ||
                updateTaskCompletionMutation.isPending
              }
              type="checkbox"
              onChange={(event) => {
                setShowCompletedTasks(event.currentTarget.checked);
              }}
            />
            <span>完了済みも表示</span>
          </label>
          <p className="management-form__hint">
            タスクの追加・編集・削除はタスク管理で行います。
          </p>
        </div>
        {taskListQuery.isPending ? (
          <ScreenLoadingState message="関連タスクを読み込んでいます..." />
        ) : taskListQuery.isError ? (
          <ScreenErrorState
            message={getApiErrorDisplayMessage(taskListQuery.error, {
              codeMessages: PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES,
              fallbackMessage: PRODUCT_ERROR_MESSAGES.tasksFetchFailed
            })}
            onRetry={handleTaskRetry}
          />
        ) : taskItems.length === 0 ? (
          <ScreenEmptyState message={taskEmptyMessage} />
        ) : (
          <div
            className="management-list product-detail-page__task-list"
            role="list"
          >
            {taskItems.map((task) => (
              <ProductTaskCard
                key={task.taskId}
                isCompletionPending={pendingTaskId === task.taskId}
                task={task}
                onCompletionChange={handleTaskCompletionChange}
              />
            ))}
          </div>
        )}
      </section>

      <section
        className="management-page__section"
        aria-labelledby="product-qr-title"
      >
        <div className="management-page__section-header">
          <div>
            <h2
              id="product-qr-title"
              className="management-page__section-title"
            >
              QRコード
            </h2>
            <p className="management-page__section-summary">
              商品識別用のQRコードを表示します。
            </p>
          </div>
        </div>
        <article className="management-card product-detail-page__qr-panel">
          <div
            className="product-detail-page__qr-code"
            role="img"
            aria-label={`${product.productId} のQRコード`}
          >
            {qrSvg ? (
              <div
                className="product-detail-page__qr-svg"
                data-testid="product-qr-svg"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <p className="product-detail-page__qr-status">
                {qrError
                  ? "QRコードを生成できませんでした。"
                  : "QRコードを生成しています..."}
              </p>
            )}
          </div>
          <div className="product-detail-page__qr-detail">
            <dl className="management-card__details">
              <div>
                <dt>QR値</dt>
                <dd className="product-detail-page__qr-value">{qrCodeValue}</dd>
              </div>
            </dl>
            <p className="management-form__hint">
              読み取り後の販売更新はQR画面で行います。
            </p>
            <div className="management-card__actions">
              <Link
                className="primary-button button-link"
                state={{ productId: product.productId, qrCodeValue }}
                to="/qr"
              >
                QR読み取りへ
              </Link>
              <button
                className="secondary-button"
                disabled={!qrSvg || qrError}
                type="button"
                onClick={handleQrPrint}
              >
                QRコードを印刷
              </button>
            </div>
          </div>
        </article>
      </section>

      {qrSvg ? (
        <aside
          className="product-detail-page__qr-print"
          aria-label={`${product.productId} の印刷用QRコード`}
        >
          <p className="product-detail-page__qr-print-title">QRコード</p>
          <p className="product-detail-page__qr-print-name">{product.name}</p>
          <p className="product-detail-page__qr-print-id">
            {product.productId}
          </p>
          <div
            className="product-detail-page__qr-print-svg"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="product-detail-page__qr-print-value">{qrCodeValue}</p>
        </aside>
      ) : null}

      {isDeleteDialogOpen ? (
        <div className="app-dialog__backdrop" role="presentation">
          <section
            aria-labelledby="product-delete-title"
            aria-modal="true"
            className="app-dialog"
            role="dialog"
          >
            <h2 id="product-delete-title">商品を削除しますか？</h2>
            <p className="app-dialog__summary">
              削除した商品は通常画面から参照できなくなります。
            </p>
            <div className="app-dialog__actions">
              <button
                className="secondary-button"
                disabled={deleteProductMutation.isPending}
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                キャンセル
              </button>
              <button
                className="danger-button"
                disabled={deleteProductMutation.isPending}
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
