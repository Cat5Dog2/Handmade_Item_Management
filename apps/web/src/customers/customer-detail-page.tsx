import type {
  CustomerArchiveData,
  CustomerDetailData,
  CustomerPurchaseItem,
  CustomerPurchasesData
} from "@handmade/shared";
import { getCustomerPath, getCustomerPurchasesPath } from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";

interface PageNotice {
  message: string;
  type: "error" | "success";
}

const APP_NAME = "Handmade Item Management";
const CUSTOMER_NOT_FOUND_MESSAGE = "対象の顧客が見つかりません。";
const CUSTOMER_ERROR_MESSAGES = {
  CUSTOMER_NOT_FOUND: CUSTOMER_NOT_FOUND_MESSAGE
} as const;

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

const priceFormatter = new Intl.NumberFormat("ja-JP", {
  currency: "JPY",
  style: "currency"
});

function formatDate(value: string | null) {
  if (!value) {
    return "購入なし";
  }

  return dateFormatter.format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "未設定";
  }

  return dateTimeFormatter.format(new Date(value));
}

function formatOptionalText(value: string | null, fallback = "未設定") {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value;
}

function formatLastPurchaseProduct(summary: CustomerDetailData["summary"]) {
  if (!summary.lastPurchaseProductName || !summary.lastPurchaseProductId) {
    return "購入商品なし";
  }

  return `${summary.lastPurchaseProductName} (${summary.lastPurchaseProductId})`;
}

function formatPrice(price: number) {
  return priceFormatter.format(price);
}

function getSnsHeading(account: CustomerDetailData["customer"]["snsAccounts"][number]) {
  if (account.platform && account.accountName) {
    return `${account.platform}: ${account.accountName}`;
  }

  if (account.platform) {
    return account.platform;
  }

  if (account.accountName) {
    return account.accountName;
  }

  return "SNSアカウント";
}

function CustomerPurchaseCard({ purchase }: { purchase: CustomerPurchaseItem }) {
  return (
    <Link
      aria-labelledby={`purchase-name-${purchase.productId}`}
      className="management-card customer-detail-page__purchase-card"
      role="listitem"
      to={`/products/${purchase.productId}`}
    >
      <div className="management-card__header">
        <div>
          <p className="customer-detail-page__purchase-id">{purchase.productId}</p>
          <h3
            id={`purchase-name-${purchase.productId}`}
            className="management-card__title"
          >
            {purchase.name}
          </h3>
        </div>
      </div>
      <dl className="management-card__details">
        <div>
          <dt>販売日時</dt>
          <dd>{formatDateTime(purchase.soldAt)}</dd>
        </div>
        <div>
          <dt>販売価格</dt>
          <dd>{formatPrice(purchase.price)}</dd>
        </div>
      </dl>
    </Link>
  );
}

export function CustomerDetailPage() {
  const apiClient = useApiClient();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { customerId } = useParams();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  useEffect(() => {
    const nextNotice =
      typeof location.state === "object" &&
      location.state !== null &&
      "notice" in location.state
        ? (location.state.notice as PageNotice | null | undefined)
        : null;

    if (!nextNotice) {
      return;
    }

    setNotice(nextNotice);
    navigate(
      {
        pathname: location.pathname,
        search: location.search
      },
      {
        replace: true,
        state: null
      }
    );
  }, [location.pathname, location.search, location.state, navigate]);

  const customerDetailQuery = useQuery({
    enabled: Boolean(customerId),
    queryKey: customerId
      ? queryKeys.customers.detail(customerId)
      : ["customers", "detail", "missing"],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<CustomerDetailData>(
        getCustomerPath(customerId ?? ""),
        {
          signal
        }
      );

      return response.data;
    }
  });

  const customerPurchasesQuery = useQuery({
    enabled: Boolean(customerId),
    queryKey: customerId
      ? queryKeys.customers.purchases(customerId)
      : ["customers", "purchases", "missing"],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<CustomerPurchasesData>(
        getCustomerPurchasesPath(customerId ?? ""),
        {
          signal
        }
      );

      return response.data;
    }
  });

  const archiveCustomerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<CustomerArchiveData>(
        getCustomerPath(customerId ?? "")
      );

      return response.data;
    },
    onSuccess: async () => {
      if (!customerId) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customers", "list"]
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.detail(customerId)
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.purchases(customerId)
        })
      ]);
    }
  });

  if (!customerId) {
    return (
      <section className="management-page customer-detail-page" aria-labelledby="customer-detail-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="customer-detail-title">顧客詳細</h1>
          <p className="management-page__lead">
            顧客情報と購入履歴を確認します。
          </p>
        </div>
        <ScreenErrorState message={CUSTOMER_NOT_FOUND_MESSAGE} />
      </section>
    );
  }

  const isInitialLoading =
    customerDetailQuery.isPending || customerPurchasesQuery.isPending;
  const loadError = customerDetailQuery.error ?? customerPurchasesQuery.error;

  const handleRetry = () => {
    setNotice(null);
    void Promise.all([
      customerDetailQuery.refetch(),
      customerPurchasesQuery.refetch()
    ]);
  };

  const handleArchiveConfirm = async () => {
    setNotice(null);

    try {
      await archiveCustomerMutation.mutateAsync();
      navigate("/customers", {
        replace: true,
        state: {
          notice: {
            message: "顧客をアーカイブしました。",
            type: "success"
          } satisfies PageNotice
        }
      });
    } catch (error) {
      setIsArchiveDialogOpen(false);
      setNotice({
        message: getApiErrorDisplayMessage(error, {
          codeMessages: CUSTOMER_ERROR_MESSAGES,
          fallbackMessage: "顧客をアーカイブできませんでした。"
        }),
        type: "error"
      });
    }
  };

  if (isInitialLoading) {
    return (
      <section className="management-page customer-detail-page" aria-labelledby="customer-detail-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="customer-detail-title">顧客詳細</h1>
          <p className="management-page__lead">
            顧客情報と購入履歴を確認します。
          </p>
        </div>
        <ScreenLoadingState message="顧客情報を読み込んでいます..." />
      </section>
    );
  }

  if (loadError || !customerDetailQuery.data || !customerPurchasesQuery.data) {
    return (
      <section className="management-page customer-detail-page" aria-labelledby="customer-detail-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="customer-detail-title">顧客詳細</h1>
          <p className="management-page__lead">
            顧客情報と購入履歴を確認します。
          </p>
        </div>
        <ScreenErrorState
          message={getApiErrorDisplayMessage(loadError, {
            codeMessages: CUSTOMER_ERROR_MESSAGES,
            fallbackMessage: "顧客情報を取得できませんでした。"
          })}
          onRetry={handleRetry}
        />
      </section>
    );
  }

  const { customer, summary } = customerDetailQuery.data;
  const purchaseItems = customerPurchasesQuery.data.items;
  const isRefreshing =
    customerDetailQuery.isFetching || customerPurchasesQuery.isFetching;
  const isPageBusy = isRefreshing || archiveCustomerMutation.isPending;

  return (
    <section className="management-page customer-detail-page" aria-labelledby="customer-detail-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div className="customer-detail-page__header-row">
          <div>
            <h1 id="customer-detail-title">{customer.name}</h1>
            <p className="management-page__lead">
              顧客情報と購入履歴を確認します。
            </p>
          </div>
          <div className="customer-detail-page__action-row">
            {!customer.isArchived ? (
              <Link
                className="secondary-button button-link"
                to={`/customers/${customer.customerId}/edit`}
              >
                編集する
              </Link>
            ) : null}
            <button
              className="danger-button"
              disabled={customer.isArchived || isPageBusy}
              type="button"
              onClick={() => setIsArchiveDialogOpen(true)}
            >
              {customer.isArchived ? "アーカイブ済み" : "アーカイブ"}
            </button>
          </div>
        </div>
        {isRefreshing ? (
          <p className="management-page__sync" role="status">
            最新の顧客情報を更新中です...
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
        {customer.isArchived ? (
          <div className="management-page__status" role="status">
            この顧客はアーカイブ済みです。購入履歴の参照のみ可能です。
          </div>
        ) : null}
      </div>

      <section className="management-page__section" aria-labelledby="customer-basic-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="customer-basic-title" className="management-page__section-title">
              基本情報
            </h2>
            <p className="management-page__section-summary">
              顧客属性と登録状態を確認します。
            </p>
          </div>
        </div>
        <article className="management-card">
          <dl className="management-card__details customer-detail-page__summary-grid">
            <div>
              <dt>顧客ID</dt>
              <dd>{customer.customerId}</dd>
            </div>
            <div>
              <dt>性別</dt>
              <dd>{formatOptionalText(customer.gender)}</dd>
            </div>
            <div>
              <dt>年代</dt>
              <dd>{formatOptionalText(customer.ageGroup)}</dd>
            </div>
            <div>
              <dt>系統メモ</dt>
              <dd>{formatOptionalText(customer.customerStyle)}</dd>
            </div>
            <div>
              <dt>登録日時</dt>
              <dd>{formatDateTime(customer.createdAt)}</dd>
            </div>
            <div>
              <dt>更新日時</dt>
              <dd>{formatDateTime(customer.updatedAt)}</dd>
            </div>
            {customer.isArchived ? (
              <div>
                <dt>アーカイブ日時</dt>
                <dd>{formatDateTime(customer.archivedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </article>
      </section>

      <section className="management-page__section" aria-labelledby="customer-sns-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="customer-sns-title" className="management-page__section-title">
              SNSアカウントとメモ
            </h2>
            <p className="management-page__section-summary">
              連絡先の補足情報と顧客メモを確認します。
            </p>
          </div>
        </div>

        {customer.snsAccounts.length === 0 ? (
          <ScreenEmptyState message="SNSアカウントは登録されていません。" />
        ) : (
          <div className="management-list customer-detail-page__sns-list" role="list">
            {customer.snsAccounts.map((account, index) => (
              <article
                key={`${account.platform ?? "sns"}-${account.accountName ?? "account"}-${index}`}
                className="management-card"
                role="listitem"
              >
                <div className="management-card__header">
                  <div>
                    <h3 className="management-card__title">{getSnsHeading(account)}</h3>
                  </div>
                </div>
                <dl className="management-card__details">
                  <div>
                    <dt>プラットフォーム</dt>
                    <dd>{formatOptionalText(account.platform ?? null)}</dd>
                  </div>
                  <div>
                    <dt>アカウント名</dt>
                    <dd>{formatOptionalText(account.accountName ?? null)}</dd>
                  </div>
                  <div>
                    <dt>URL</dt>
                    <dd>
                      {account.url ? (
                        <a
                          className="customer-detail-page__external-link"
                          href={account.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {account.url}
                        </a>
                      ) : (
                        "未設定"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>補足</dt>
                    <dd>{formatOptionalText(account.note ?? null)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}

        <article className="management-card">
          <div className="management-card__header">
            <div>
              <h3 className="management-card__title">顧客メモ</h3>
            </div>
          </div>
          <p className="customer-detail-page__memo">
            {formatOptionalText(customer.memo, "メモはありません。")}
          </p>
        </article>
      </section>

      <section className="management-page__section" aria-labelledby="customer-summary-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="customer-summary-title" className="management-page__section-title">
              購入サマリ
            </h2>
            <p className="management-page__section-summary">
              最終購入情報と購入回数を確認します。
            </p>
          </div>
        </div>
        <article className="management-card">
          <dl className="management-card__details customer-detail-page__summary-grid">
            <div>
              <dt>最終購入日</dt>
              <dd>{formatDate(summary.lastPurchaseAt)}</dd>
            </div>
            <div>
              <dt>最終購入商品</dt>
              <dd>{formatLastPurchaseProduct(summary)}</dd>
            </div>
            <div>
              <dt>購入回数</dt>
              <dd>{`${summary.purchaseCount}件`}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="management-page__section" aria-labelledby="customer-purchases-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="customer-purchases-title" className="management-page__section-title">
              購入商品一覧
            </h2>
            <p className="management-page__section-summary">
              販売日時の新しい順で購入商品を確認できます。
            </p>
          </div>
        </div>
        {purchaseItems.length === 0 ? (
          <ScreenEmptyState message="購入履歴はありません。" />
        ) : (
          <div className="management-list" role="list">
            {purchaseItems.map((purchase) => (
              <CustomerPurchaseCard key={purchase.productId} purchase={purchase} />
            ))}
          </div>
        )}
      </section>

      {isArchiveDialogOpen ? (
        <div className="app-dialog__backdrop" role="presentation">
          <section
            aria-labelledby="customer-archive-title"
            aria-modal="true"
            className="app-dialog"
            role="dialog"
          >
            <h2 id="customer-archive-title">顧客をアーカイブしますか？</h2>
            <p className="app-dialog__summary">
              アーカイブした顧客は通常一覧に表示されなくなります。購入履歴の参照は保持されます。
            </p>
            <div className="app-dialog__actions">
              <button
                className="secondary-button"
                disabled={archiveCustomerMutation.isPending}
                type="button"
                onClick={() => setIsArchiveDialogOpen(false)}
              >
                キャンセル
              </button>
              <button
                className="danger-button"
                disabled={archiveCustomerMutation.isPending}
                type="button"
                onClick={() => {
                  void handleArchiveConfirm();
                }}
              >
                アーカイブ
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
