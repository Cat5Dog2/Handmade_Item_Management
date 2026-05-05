import type {
  CategoryListData,
  ProductListData,
  ProductListMeta,
  ProductListQuery,
  ProductSortBy,
  ProductStatus,
  SortOrder,
  TagListData
} from "@handmade/shared";
import {
  API_PATHS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  productListQuerySchema
} from "@handmade/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import { APP_NAME, PRODUCT_ERROR_MESSAGES } from "../messages/display-messages";

interface PageNotice {
  message: string;
  type: "error" | "success";
}

interface ProductListQueryParseResult {
  errorMessage: string | null;
  query: ProductListQuery;
}

interface ProductListFilterState {
  categoryId: string;
  includeSold: boolean;
  keyword: string;
  sortBy: ProductSortBy;
  sortOrder: SortOrder;
  status: ProductStatus | "";
  tagId: string;
}

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_QUERY: Required<
  Pick<ProductListQuery, "includeSold" | "page" | "pageSize" | "sortBy" | "sortOrder">
> = {
  includeSold: true,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: "updatedAt",
  sortOrder: "desc"
};

const DEFAULT_FILTER_STATE: ProductListFilterState = {
  categoryId: "",
  includeSold: true,
  keyword: "",
  sortBy: DEFAULT_QUERY.sortBy,
  sortOrder: DEFAULT_QUERY.sortOrder,
  status: "",
  tagId: ""
};
const PRODUCT_LIST_QUERY_ERROR_MESSAGE =
  "\u691c\u7d22\u6761\u4ef6\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002";

const productListDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
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

function formatUpdatedAt(updatedAt: string) {
  return productListDateTimeFormatter.format(new Date(updatedAt));
}

function normalizeProductListQuery(query: ProductListQuery): ProductListQuery {
  const normalized: ProductListQuery = {
    categoryId: query.categoryId,
    includeSold: query.includeSold ?? DEFAULT_QUERY.includeSold,
    keyword: query.keyword,
    page: query.page ?? DEFAULT_QUERY.page,
    pageSize: query.pageSize ?? DEFAULT_QUERY.pageSize,
    sortBy: query.sortBy ?? DEFAULT_QUERY.sortBy,
    sortOrder: query.sortOrder ?? DEFAULT_QUERY.sortOrder,
    status: query.status,
    tagId: query.tagId
  };

  if (normalized.status === "sold") {
    return {
      ...normalized,
      includeSold: true
    };
  }

  return normalized;
}

function parseProductListQuery(
  searchParams: URLSearchParams
): ProductListQueryParseResult {
  const parsedQuery = productListQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!parsedQuery.success) {
    return {
      errorMessage: PRODUCT_LIST_QUERY_ERROR_MESSAGE,
      query: DEFAULT_QUERY as ProductListQuery
    };
  }

  return {
    errorMessage: null,
    query: normalizeProductListQuery(parsedQuery.data)
  };
}

function toFilterState(query: ProductListQuery): ProductListFilterState {
  return {
    categoryId: query.categoryId ?? "",
    includeSold: query.includeSold ?? DEFAULT_QUERY.includeSold,
    keyword: query.keyword ?? "",
    sortBy: query.sortBy ?? DEFAULT_QUERY.sortBy,
    sortOrder: query.sortOrder ?? DEFAULT_QUERY.sortOrder,
    status: query.status ?? "",
    tagId: query.tagId ?? ""
  };
}

function buildProductListRequestQuery(query: ProductListQuery) {
  return {
    categoryId: query.categoryId,
    includeSold: query.includeSold,
    keyword: query.keyword,
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    status: query.status,
    tagId: query.tagId
  };
}

function buildSearchParams(
  filters: ProductListFilterState,
  pageSize: number,
  page: number
) {
  const searchParams = new URLSearchParams();
  const keyword = filters.keyword.trim();
  const status = filters.status || undefined;
  const includeSold = status === "sold" ? true : filters.includeSold;

  if (keyword) {
    searchParams.set("keyword", keyword);
  }

  if (filters.categoryId) {
    searchParams.set("categoryId", filters.categoryId);
  }

  if (filters.tagId) {
    searchParams.set("tagId", filters.tagId);
  }

  if (status) {
    searchParams.set("status", status);
  }

  if (filters.sortBy !== DEFAULT_QUERY.sortBy) {
    searchParams.set("sortBy", filters.sortBy);
  }

  if (filters.sortOrder !== DEFAULT_QUERY.sortOrder) {
    searchParams.set("sortOrder", filters.sortOrder);
  }

  if (page !== DEFAULT_QUERY.page) {
    searchParams.set("page", String(page));
  }

  if (pageSize !== DEFAULT_QUERY.pageSize) {
    searchParams.set("pageSize", String(pageSize));
  }

  if (!includeSold) {
    searchParams.set("includeSold", "false");
  } else if (status === "sold") {
    searchParams.set("includeSold", "true");
  }

  return searchParams;
}

function isDefaultFilterState(filters: ProductListFilterState) {
  return (
    filters.categoryId === DEFAULT_FILTER_STATE.categoryId &&
    filters.includeSold === DEFAULT_FILTER_STATE.includeSold &&
    filters.keyword === DEFAULT_FILTER_STATE.keyword &&
    filters.sortBy === DEFAULT_FILTER_STATE.sortBy &&
    filters.sortOrder === DEFAULT_FILTER_STATE.sortOrder &&
    filters.status === DEFAULT_FILTER_STATE.status &&
    filters.tagId === DEFAULT_FILTER_STATE.tagId
  );
}

function EmptyImagePlaceholder() {
  return <div className="product-list-card__image-placeholder">画像なし</div>;
}

export function ProductListPage() {
  const apiClient = useApiClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const currentQueryParseResult = useMemo(
    () => parseProductListQuery(new URLSearchParams(searchParamsString)),
    [searchParamsString]
  );
  const currentQuery = currentQueryParseResult.query;
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [draftFilters, setDraftFilters] = useState<ProductListFilterState>(() =>
    toFilterState(currentQuery)
  );
  const previousIncludeSoldRef = useRef(DEFAULT_FILTER_STATE.includeSold);

  useEffect(() => {
    setDraftFilters(toFilterState(currentQuery));

    if (currentQuery.status !== "sold") {
      previousIncludeSoldRef.current = currentQuery.includeSold ?? true;
    }
  }, [currentQuery]);

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

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list,
    queryFn: async () => {
      const response = await apiClient.get<CategoryListData>(API_PATHS.categories);

      return response.data;
    }
  });

  const tagsQuery = useQuery({
    queryKey: queryKeys.tags.list,
    queryFn: async () => {
      const response = await apiClient.get<TagListData>(API_PATHS.tags);

      return response.data;
    }
  });

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(currentQuery),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<ProductListData, ProductListMeta>(
        API_PATHS.products,
        {
          query: buildProductListRequestQuery(currentQuery),
          signal
        }
      );

      return response;
    }
  });

  const categories = categoriesQuery.data?.items ?? [];
  const tags = tagsQuery.data?.items ?? [];
  const productItems = productsQuery.data?.data.items ?? [];
  const productMeta = productsQuery.data?.meta;
  const isInitialLoading = productsQuery.isPending;
  const hasActiveFilters =
    !isDefaultFilterState(draftFilters) || currentQuery.page !== DEFAULT_QUERY.page;

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const pageSize = currentQuery.pageSize ?? DEFAULT_QUERY.pageSize;
    const includeSold =
      draftFilters.status === "sold" ? true : draftFilters.includeSold;
    const nextQueryInput: ProductListQuery = {
      categoryId: draftFilters.categoryId || undefined,
      includeSold,
      keyword: draftFilters.keyword || undefined,
      page: DEFAULT_QUERY.page,
      pageSize,
      sortBy: draftFilters.sortBy,
      sortOrder: draftFilters.sortOrder,
      status: draftFilters.status || undefined,
      tagId: draftFilters.tagId || undefined
    };
    const parsedNextQuery = productListQuerySchema.safeParse(nextQueryInput);

    if (!parsedNextQuery.success) {
      setNotice({
        message: PRODUCT_LIST_QUERY_ERROR_MESSAGE,
        type: "error"
      });
      return;
    }

    const nextQuery = normalizeProductListQuery(parsedNextQuery.data);
    setNotice(null);
    setSearchParams(buildSearchParams(toFilterState(nextQuery), pageSize, DEFAULT_QUERY.page));
  };

  const clearFilters = () => {
    setNotice(null);
    previousIncludeSoldRef.current = DEFAULT_FILTER_STATE.includeSold;
    setDraftFilters(DEFAULT_FILTER_STATE);
    setSearchParams(
      buildSearchParams(DEFAULT_FILTER_STATE, currentQuery.pageSize ?? DEFAULT_PAGE_SIZE, 1)
    );
  };

  const movePage = (nextPage: number) => {
    setNotice(null);
    setSearchParams(
      buildSearchParams(
        toFilterState(currentQuery),
        currentQuery.pageSize ?? DEFAULT_PAGE_SIZE,
        nextPage
      )
    );
  };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = event.target.value as ProductStatus | "";

    setDraftFilters((current) => {
      if (nextStatus === "sold") {
        previousIncludeSoldRef.current = current.includeSold;

        return {
          ...current,
          includeSold: true,
          status: nextStatus
        };
      }

      return {
        ...current,
        includeSold:
          current.status === "sold"
            ? previousIncludeSoldRef.current
            : current.includeSold,
        status: nextStatus
      };
    });
  };

  if (isInitialLoading) {
    return (
      <section className="management-page product-list-page" aria-labelledby="products-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <div className="product-list-page__header-row">
            <div>
              <h1 id="products-title">商品一覧</h1>
              <p className="management-page__lead">
                条件を整えて必要な一点へすばやくたどり着きます。
              </p>
            </div>
            <Link className="primary-button button-link" to="/products/new">
              商品登録
            </Link>
          </div>
        </div>
        <ScreenLoadingState message="商品一覧を読み込んでいます..." />
      </section>
    );
  }

  if (productsQuery.isError) {
    return (
      <section className="management-page product-list-page" aria-labelledby="products-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <div className="product-list-page__header-row">
            <div>
              <h1 id="products-title">商品一覧</h1>
              <p className="management-page__lead">
                条件を整えて必要な一点へすばやくたどり着きます。
              </p>
            </div>
            <Link className="primary-button button-link" to="/products/new">
              商品登録
            </Link>
          </div>
        </div>
        <ScreenErrorState
          message={getApiErrorDisplayMessage(productsQuery.error, {
            fallbackMessage: PRODUCT_ERROR_MESSAGES.listFetchFailed
          })}
          onRetry={() => {
            void productsQuery.refetch();
          }}
        />
      </section>
    );
  }

  const totalCount = productMeta?.totalCount ?? productItems.length;
  const currentPage = productMeta?.page ?? currentQuery.page ?? DEFAULT_QUERY.page;
  const pageSize = productMeta?.pageSize ?? currentQuery.pageSize ?? DEFAULT_PAGE_SIZE;
  const lastPage = Math.max(Math.ceil(totalCount / pageSize), 1);
  const canGoPrevious = currentPage > 1;
  const canGoNext = productMeta?.hasNext ?? false;

  return (
    <section className="management-page product-list-page" aria-labelledby="products-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div className="product-list-page__header-row">
          <div>
            <h1 id="products-title">商品一覧</h1>
            <p className="management-page__lead">
              条件を整えて必要な一点へすばやくたどり着きます。
            </p>
          </div>
          <Link className="primary-button button-link" to="/products/new">
            商品登録
          </Link>
        </div>
        {productsQuery.isFetching ? (
          <p className="management-page__sync" role="status">
            最新の一覧を更新中です...
          </p>
        ) : null}
        {currentQueryParseResult.errorMessage || notice ? (
          <div
            className={
              notice?.type === "success" && !currentQueryParseResult.errorMessage
                ? "management-page__notice is-success"
                : "management-page__notice is-error"
            }
            role={notice?.type === "success" && !currentQueryParseResult.errorMessage ? "status" : "alert"}
          >
            <p>{currentQueryParseResult.errorMessage ?? notice?.message}</p>
          </div>
        ) : null}
      </div>

      <section className="management-page__section" aria-labelledby="product-filters-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="product-filters-title" className="management-page__section-title">
              検索条件
            </h2>
            <p className="management-page__section-summary">
              商品名、商品ID、説明、カテゴリ名、タグ名を対象に絞り込めます。
            </p>
          </div>
        </div>
        <form className="management-form product-list-filters" noValidate onSubmit={applyFilters}>
          <div className="management-form__grid">
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-keyword">
                キーワード
              </label>
              <input
                id="product-keyword"
                className="auth-field__input"
                type="search"
                value={draftFilters.keyword}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    keyword: event.target.value
                  }))
                }
              />
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-category">
                カテゴリ
              </label>
              <select
                id="product-category"
                className="auth-field__input"
                value={draftFilters.categoryId}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    categoryId: event.target.value
                  }))
                }
              >
                <option value="">すべて</option>
                {categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-tag">
                タグ
              </label>
              <select
                id="product-tag"
                className="auth-field__input"
                value={draftFilters.tagId}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    tagId: event.target.value
                  }))
                }
              >
                <option value="">すべて</option>
                {tags.map((tag) => (
                  <option key={tag.tagId} value={tag.tagId}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-status">
                ステータス
              </label>
              <select
                id="product-status"
                className="auth-field__input"
                value={draftFilters.status}
                onChange={handleStatusChange}
              >
                <option value="">すべて</option>
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PRODUCT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-sort-by">
                並び順
              </label>
              <select
                id="product-sort-by"
                className="auth-field__input"
                value={draftFilters.sortBy}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    sortBy: event.target.value as ProductSortBy
                  }))
                }
              >
                <option value="updatedAt">更新日時</option>
                <option value="name">商品名</option>
              </select>
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-sort-order">
                並び順方向
              </label>
              <select
                id="product-sort-order"
                className="auth-field__input"
                value={draftFilters.sortOrder}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    sortOrder: event.target.value as SortOrder
                  }))
                }
              >
                <option value="desc">降順</option>
                <option value="asc">昇順</option>
              </select>
            </div>

            <label className="product-list-filters__toggle">
              <input
                checked={draftFilters.status === "sold" ? true : draftFilters.includeSold}
                disabled={draftFilters.status === "sold"}
                type="checkbox"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    includeSold: event.target.checked
                  }))
                }
              />
              <span>販売済みを含める</span>
            </label>

            {draftFilters.status === "sold" ? (
              <p className="management-form__hint product-list-filters__note">
                販売済みを選ぶと自動で ON になります。
              </p>
            ) : null}
          </div>

          <div className="management-form__actions">
            <button className="primary-button" type="submit">
              絞り込む
            </button>
            <button
              className="secondary-button"
              disabled={!hasActiveFilters}
              type="button"
              onClick={clearFilters}
            >
              条件をクリア
            </button>
          </div>
        </form>
      </section>

      <section className="management-page__section" aria-labelledby="product-list-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="product-list-title" className="management-page__section-title">
              商品一覧
            </h2>
            <p className="management-page__section-summary">
              サムネイル、商品名、商品ID、ステータス、カテゴリ、更新日時を表示します。
            </p>
          </div>
          <p className="management-page__sync" role="status">
            {currentPage} / {lastPage}
          </p>
        </div>

        {productItems.length === 0 ? (
          <ScreenEmptyState message="条件に合う商品が見つかりませんでした。">
            <div className="management-form__actions">
              <button className="secondary-button" type="button" onClick={clearFilters}>
                条件をクリア
              </button>
              <Link className="primary-button button-link" to="/products/new">
                商品登録
              </Link>
            </div>
          </ScreenEmptyState>
        ) : (
          <>
            <div className="product-list-grid" role="list">
              {productItems.map((product) => (
                <Link
                  key={product.productId}
                  aria-labelledby={`product-name-${product.productId}`}
                  className="product-list-card"
                  role="listitem"
                  to={`/products/${product.productId}`}
                >
                  <div className="product-list-card__image">
                    {product.thumbnailUrl ? (
                      <img
                        alt={product.name}
                        className="product-list-card__image-element"
                        loading="lazy"
                        src={product.thumbnailUrl}
                      />
                    ) : (
                      <EmptyImagePlaceholder />
                    )}
                  </div>

                  <div className="product-list-card__body">
                    <div className="product-list-card__header">
                      <div>
                        <p className="product-list-card__product-id">{product.productId}</p>
                        <h3
                          id={`product-name-${product.productId}`}
                          className="product-list-card__title"
                        >
                          {product.name}
                        </h3>
                      </div>
                      <span className={productStatusBadgeClassNames[product.status]}>
                        {PRODUCT_STATUS_LABELS[product.status]}
                      </span>
                    </div>

                    <dl className="product-list-card__details">
                      <div>
                        <dt>カテゴリ</dt>
                        <dd>{product.categoryName ?? "未設定"}</dd>
                      </div>
                      <div>
                        <dt>更新日時</dt>
                        <dd>{formatUpdatedAt(product.updatedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                </Link>
              ))}
            </div>

            <div className="product-list-pagination" aria-label="ページング">
              <button
                className="secondary-button"
                disabled={!canGoPrevious}
                type="button"
                onClick={() => movePage(currentPage - 1)}
              >
                前へ
              </button>
              <p className="product-list-pagination__status">
                {currentPage} / {lastPage}
              </p>
              <button
                className="secondary-button"
                disabled={!canGoNext}
                type="button"
                onClick={() => movePage(currentPage + 1)}
              >
                次へ
              </button>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
