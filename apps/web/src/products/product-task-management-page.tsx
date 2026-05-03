import type { ProductDetailData, TaskItem, TaskListData } from "@handmade/shared";
import { getProductPath, getProductTasksPath } from "@handmade/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
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

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric"
});

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo"
});

function formatDate(value: string | null) {
  if (!value) {
    return "期限未設定";
  }

  return dateFormatter.format(new Date(`${value}T00:00:00+09:00`));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "未設定";
  }

  return dateTimeFormatter.format(new Date(value));
}

function TaskManagementCard({ task }: { task: TaskItem }) {
  return (
    <article className="management-card task-management-page__task-card" role="listitem">
      <div className="management-card__header">
        <div>
          <p className="management-card__subtitle">
            {task.isCompleted ? "完了済み" : "未完了"}
          </p>
          <h3 className="management-card__title">{task.name}</h3>
        </div>
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
    </article>
  );
}

export function ProductTaskManagementPage() {
  const apiClient = useApiClient();
  const { productId } = useParams();

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
          showCompleted: false
        })
      : ["products", "tasks", "missing"],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<TaskListData>(
        getProductTasksPath(productId ?? ""),
        {
          query: {
            showCompleted: false
          },
          signal
        }
      );

      return response.data;
    }
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
    if (productDetailQuery.isError) {
      void productDetailQuery.refetch();
      return;
    }

    void taskListQuery.refetch();
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

  return (
    <section
      className="management-page task-management-page"
      aria-labelledby="task-management-title"
    >
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div className="task-management-page__header-row">
          <div>
            <p className="task-management-page__product-id">{product.productId}</p>
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
      </div>

      <section className="management-page__section" aria-labelledby="task-list-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="task-list-title" className="management-page__section-title">
              タスク一覧
            </h2>
            <p className="management-page__section-summary">
              未完了タスクを期限が近い順に表示します。
            </p>
          </div>
        </div>
        <div className="task-management-page__summary" role="status">
          <span>{`未完了 ${tasksSummary.openCount}件`}</span>
          <span>{`完了 ${tasksSummary.completedCount}件`}</span>
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
          <ScreenEmptyState message="未完了のタスクはありません。" />
        ) : (
          <div className="management-list task-management-page__task-list" role="list">
            {taskItems.map((task) => (
              <TaskManagementCard key={task.taskId} task={task} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
