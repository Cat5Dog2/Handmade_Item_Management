import type {
  ProductDetailData,
  ProductImageDetail,
  ProductStatus,
  TaskItem,
  TaskListData
} from "@handmade/shared";
import {
  getProductPath,
  getProductTasksPath,
  PRODUCT_STATUS_LABELS
} from "@handmade/shared";
import { useQuery } from "@tanstack/react-query";
import { toString as generateQRCodeSvg } from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "../api/api-client";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";

const APP_NAME = "Handmade Item Management";
const PRODUCT_DETAIL_ERROR_MESSAGE =
  "商品詳細の取得に失敗しました。再度お試しください。";
const PRODUCT_NOT_FOUND_MESSAGE = "対象の商品が見つかりません。";
const PRODUCT_DELETED_MESSAGE = "対象の商品は削除済みです。";
const PRODUCT_TASKS_ERROR_MESSAGE =
  "タスク一覧を取得できませんでした。再度お試しください。";
const PRODUCT_TASKS_UNAVAILABLE_MESSAGE =
  "この商品のタスクは表示できません。";

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

const productStatusBadgeClassNames: Record<ProductStatus, string> = {
  beforeProduction: "product-status-badge is-before-production",
  completed: "product-status-badge is-completed",
  inProduction: "product-status-badge is-in-production",
  inStock: "product-status-badge is-in-stock",
  onDisplay: "product-status-badge is-on-display",
  sold: "product-status-badge is-sold"
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "PRODUCT_NOT_FOUND") {
      return PRODUCT_NOT_FOUND_MESSAGE;
    }

    if (error.code === "PRODUCT_DELETED") {
      return PRODUCT_DELETED_MESSAGE;
    }

    return error.message;
  }

  return PRODUCT_DETAIL_ERROR_MESSAGE;
}

function getTaskErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "PRODUCT_RELATED_RESOURCE_UNAVAILABLE") {
      return PRODUCT_TASKS_UNAVAILABLE_MESSAGE;
    }

    if (error.code === "PRODUCT_NOT_FOUND") {
      return PRODUCT_NOT_FOUND_MESSAGE;
    }

    return error.message;
  }

  return PRODUCT_TASKS_ERROR_MESSAGE;
}

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

function formatPrice(price: number) {
  return priceFormatter.format(price);
}

function formatOptionalText(value: string | null | undefined, fallback = "未設定") {
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

function ProductTaskCard({ task }: { task: TaskItem }) {
  return (
    <article className="management-card product-detail-page__task-card" role="listitem">
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
  const { productId } = useParams();
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

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
        <div className="management-page__notice is-error" role="alert">
          <p>{PRODUCT_NOT_FOUND_MESSAGE}</p>
        </div>
      </section>
    );
  }

  const handleRetry = () => {
    void productDetailQuery.refetch();
  };

  const handleTaskRetry = () => {
    void taskListQuery.refetch();
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
        <div className="management-page__status" role="status">
          商品詳細を読み込んでいます...
        </div>
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
        <div className="management-page__notice is-error" role="alert">
          <p>{getErrorMessage(productDetailQuery.error)}</p>
          <button className="secondary-button" type="button" onClick={handleRetry}>
            再試行
          </button>
        </div>
      </section>
    );
  }

  const { images, product, tasksSummary } = productDetailQuery.data;
  const tagText = product.tagNames.length > 0 ? product.tagNames.join(", ") : "タグなし";
  const taskItems = taskListQuery.data?.items ?? [];
  const shouldShowCustomerLink =
    product.status === "sold" && Boolean(product.soldCustomerId);

  return (
    <section
      className="management-page product-detail-page"
      aria-labelledby="product-detail-title"
    >
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div className="product-detail-page__header-row">
          <div>
            <p className="product-detail-page__product-id">{product.productId}</p>
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
          </div>
        </div>
        {productDetailQuery.isFetching ? (
          <p className="management-page__sync" role="status">
            最新の商品詳細を更新中です...
          </p>
        ) : null}
      </div>

      <section className="management-page__section" aria-labelledby="product-basic-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="product-basic-title" className="management-page__section-title">
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

      <section className="management-page__section" aria-labelledby="product-tasks-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="product-tasks-title" className="management-page__section-title">
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
        {taskListQuery.isPending ? (
          <div className="management-page__status" role="status">
            関連タスクを読み込んでいます...
          </div>
        ) : taskListQuery.isError ? (
          <div className="management-page__notice is-error" role="alert">
            <p>{getTaskErrorMessage(taskListQuery.error)}</p>
            <button className="secondary-button" type="button" onClick={handleTaskRetry}>
              再試行
            </button>
          </div>
        ) : taskItems.length === 0 ? (
          <div className="management-page__empty">
            <p>タスクはまだありません。必要な作業を追加してください。</p>
          </div>
        ) : (
          <div className="management-list product-detail-page__task-list" role="list">
            {taskItems.map((task) => (
              <ProductTaskCard key={task.taskId} task={task} />
            ))}
          </div>
        )}
      </section>

      <section className="management-page__section" aria-labelledby="product-qr-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="product-qr-title" className="management-page__section-title">
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
            <div className="management-card__actions">
              <Link
                className="primary-button button-link"
                state={{ productId: product.productId, qrCodeValue }}
                to="/qr"
              >
                QR読み取りへ
              </Link>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
