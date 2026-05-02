import type {
  DashboardDueSoonTask,
  DashboardRecentProduct,
  DashboardResponseData,
  ProductStatus
} from "@handmade/shared";
import {
  API_PATHS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES
} from "@handmade/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import { APP_NAME, DASHBOARD_ERROR_MESSAGES } from "../messages/display-messages";

const dashboardDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric"
});

const productStatusBadgeClassNames: Record<ProductStatus, string> = {
  beforeProduction: "product-status-badge is-before-production",
  completed: "product-status-badge is-completed",
  inProduction: "product-status-badge is-in-production",
  inStock: "product-status-badge is-in-stock",
  onDisplay: "product-status-badge is-on-display",
  sold: "product-status-badge is-sold"
};

function getDashboardErrorMessage(error: unknown) {
  return getApiErrorDisplayMessage(error, {
    fallbackMessage: DASHBOARD_ERROR_MESSAGES.fetchFailed,
    fallbackMessageCodes: ["INTERNAL_ERROR"]
  });
}

function formatDueDate(dueDate: string) {
  const [year, month, day] = dueDate.split("-");

  if (!year || !month || !day) {
    return dueDate;
  }

  return `${year}/${month}/${day}`;
}

function formatUpdatedAt(updatedAt: string) {
  return dashboardDateTimeFormatter.format(new Date(updatedAt));
}

function EmptyImagePlaceholder() {
  return <div className="dashboard-recent-product__image-placeholder">画像なし</div>;
}

function DashboardHeader({
  isFetching
}: {
  isFetching?: boolean;
}) {
  return (
    <div className="management-page__header">
      <p className="management-page__eyebrow">{APP_NAME}</p>
      <div>
        <h1 id="dashboard-title">ダッシュボード</h1>
        <p className="management-page__lead">
          制作状況と販売の流れをまとめて確認します。
        </p>
      </div>
      {isFetching ? (
        <p className="management-page__sync" role="status">
          最新のダッシュボードを更新中です...
        </p>
      ) : null}
    </div>
  );
}

function CountCard({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="dashboard-count-card">
      <p className="dashboard-count-card__label">{label}</p>
      <p className="dashboard-count-card__value">{value}</p>
    </article>
  );
}

function DueSoonTaskCard({ task }: { task: DashboardDueSoonTask }) {
  return (
    <Link
      aria-label={`${task.taskName}のタスク管理へ`}
      className="management-card dashboard-link-card"
      to={`/products/${task.productId}/tasks`}
    >
      <div className="management-card__header">
        <div>
          <p className="dashboard-link-card__id">{task.productId}</p>
          <h3 className="management-card__title">{task.taskName}</h3>
        </div>
      </div>
      <dl className="management-card__details">
        <div>
          <dt>商品</dt>
          <dd>{task.productName}</dd>
        </div>
        <div>
          <dt>期限</dt>
          <dd>{formatDueDate(task.dueDate)}</dd>
        </div>
      </dl>
    </Link>
  );
}

function RecentProductCard({ product }: { product: DashboardRecentProduct }) {
  return (
    <Link
      aria-label={`${product.name}の商品詳細へ`}
      className="dashboard-recent-product"
      to={`/products/${product.productId}`}
    >
      <div className="dashboard-recent-product__image">
        {product.thumbnailUrl ? (
          <img
            alt={product.name}
            className="dashboard-recent-product__image-element"
            loading="lazy"
            src={product.thumbnailUrl}
          />
        ) : (
          <EmptyImagePlaceholder />
        )}
      </div>
      <div className="dashboard-recent-product__body">
        <div className="dashboard-recent-product__header">
          <div>
            <p className="dashboard-link-card__id">{product.productId}</p>
            <h3 className="management-card__title">{product.name}</h3>
          </div>
          <span className={productStatusBadgeClassNames[product.status]}>
            {PRODUCT_STATUS_LABELS[product.status]}
          </span>
        </div>
        <dl className="management-card__details">
          <div>
            <dt>更新日時</dt>
            <dd>{formatUpdatedAt(product.updatedAt)}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const apiClient = useApiClient();
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.root,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<DashboardResponseData>(
        API_PATHS.dashboard,
        {
          signal
        }
      );

      return response.data;
    }
  });

  if (dashboardQuery.isPending) {
    return (
      <section className="management-page dashboard-page" aria-labelledby="dashboard-title">
        <DashboardHeader />
        <ScreenLoadingState message="ダッシュボードを読み込んでいます..." />
      </section>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <section className="management-page dashboard-page" aria-labelledby="dashboard-title">
        <DashboardHeader />
        <ScreenErrorState
          message={getDashboardErrorMessage(dashboardQuery.error)}
          onRetry={() => {
            void dashboardQuery.refetch();
          }}
        />
      </section>
    );
  }

  const dashboard = dashboardQuery.data;

  return (
    <section className="management-page dashboard-page" aria-labelledby="dashboard-title">
      <DashboardHeader isFetching={dashboardQuery.isFetching} />

      <section className="management-page__section" aria-labelledby="dashboard-counts-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="dashboard-counts-title" className="management-page__section-title">
              件数
            </h2>
            <p className="management-page__section-summary">
              ステータス別件数、販売済件数、未完了タスク件数を表示します。
            </p>
          </div>
        </div>
        <div className="dashboard-count-grid" role="list">
          {PRODUCT_STATUSES.map((status) => (
            <div key={status} role="listitem">
              <CountCard
                label={PRODUCT_STATUS_LABELS[status]}
                value={dashboard.statusCounts[status]}
              />
            </div>
          ))}
          <div role="listitem">
            <CountCard label="販売済件数" value={dashboard.soldCount} />
          </div>
          <div role="listitem">
            <CountCard label="未完了タスク件数" value={dashboard.openTaskCount} />
          </div>
        </div>
      </section>

      <div className="dashboard-page__columns">
        <section className="management-page__section" aria-labelledby="dashboard-tasks-title">
          <div className="management-page__section-header">
            <div>
              <h2 id="dashboard-tasks-title" className="management-page__section-title">
                納期が近いタスク
              </h2>
              <p className="management-page__section-summary">
                当日を含む7日以内の未完了タスクを表示します。
              </p>
            </div>
          </div>
          {dashboard.dueSoonTasks.length === 0 ? (
            <ScreenEmptyState message="期限が近いタスクはありません。" />
          ) : (
            <div className="management-list" role="list">
              {dashboard.dueSoonTasks.map((task) => (
                <div key={task.taskId} role="listitem">
                  <DueSoonTaskCard task={task} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="management-page__section" aria-labelledby="dashboard-products-title">
          <div className="management-page__section-header">
            <div>
              <h2 id="dashboard-products-title" className="management-page__section-title">
                最近更新した商品
              </h2>
              <p className="management-page__section-summary">
                更新日時が新しい商品を最大5件表示します。
              </p>
            </div>
          </div>
          {dashboard.recentProducts.length === 0 ? (
            <ScreenEmptyState message="最近更新した商品はありません。" />
          ) : (
            <div className="management-list" role="list">
              {dashboard.recentProducts.map((product) => (
                <div key={product.productId} role="listitem">
                  <RecentProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
