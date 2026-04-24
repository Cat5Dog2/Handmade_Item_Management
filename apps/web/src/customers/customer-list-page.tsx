import type {
  CustomerListData,
  CustomerListMeta,
  CustomerListQuery,
  CustomerSortBy,
  SortOrder
} from "@handmade/shared";
import { API_PATHS, customerListQuerySchema } from "@handmade/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiClientError } from "../api/api-client";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";

interface PageNotice {
  message: string;
  type: "error" | "success";
}

interface CustomerListFilterState {
  keyword: string;
  sortBy: CustomerSortBy;
  sortOrder: SortOrder;
}

const APP_NAME = "Handmade Item Management";
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_QUERY: Required<
  Pick<CustomerListQuery, "page" | "pageSize" | "sortBy" | "sortOrder">
> = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: "updatedAt",
  sortOrder: "desc"
};

const DEFAULT_FILTER_STATE: CustomerListFilterState = {
  keyword: "",
  sortBy: DEFAULT_QUERY.sortBy,
  sortOrder: DEFAULT_QUERY.sortOrder
};

const customerListDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric"
});

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return fallbackMessage;
}

function formatLastPurchaseAt(lastPurchaseAt: string | null) {
  if (!lastPurchaseAt) {
    return "購入なし";
  }

  return customerListDateFormatter.format(new Date(lastPurchaseAt));
}

function normalizeCustomerListQuery(query: CustomerListQuery): CustomerListQuery {
  return {
    keyword: query.keyword,
    page: query.page ?? DEFAULT_QUERY.page,
    pageSize: query.pageSize ?? DEFAULT_QUERY.pageSize,
    sortBy: query.sortBy ?? DEFAULT_QUERY.sortBy,
    sortOrder: query.sortOrder ?? DEFAULT_QUERY.sortOrder
  };
}

function parseCustomerListQuery(searchParams: URLSearchParams): CustomerListQuery {
  const parsedQuery = customerListQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!parsedQuery.success) {
    return DEFAULT_QUERY as CustomerListQuery;
  }

  return normalizeCustomerListQuery(parsedQuery.data);
}

function toFilterState(query: CustomerListQuery): CustomerListFilterState {
  return {
    keyword: query.keyword ?? "",
    sortBy: query.sortBy ?? DEFAULT_QUERY.sortBy,
    sortOrder: query.sortOrder ?? DEFAULT_QUERY.sortOrder
  };
}

function buildCustomerListRequestQuery(query: CustomerListQuery) {
  return {
    keyword: query.keyword,
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder
  };
}

function buildSearchParams(
  filters: CustomerListFilterState,
  pageSize: number,
  page: number
) {
  const searchParams = new URLSearchParams();
  const keyword = filters.keyword.trim();

  if (keyword) {
    searchParams.set("keyword", keyword);
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

  return searchParams;
}

function isDefaultFilterState(filters: CustomerListFilterState) {
  return (
    filters.keyword === DEFAULT_FILTER_STATE.keyword &&
    filters.sortBy === DEFAULT_FILTER_STATE.sortBy &&
    filters.sortOrder === DEFAULT_FILTER_STATE.sortOrder
  );
}

export function CustomerListPage() {
  const apiClient = useApiClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const currentQuery = useMemo(
    () => parseCustomerListQuery(new URLSearchParams(searchParamsString)),
    [searchParamsString]
  );
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [draftFilters, setDraftFilters] = useState<CustomerListFilterState>(() =>
    toFilterState(currentQuery)
  );

  useEffect(() => {
    setDraftFilters(toFilterState(currentQuery));
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

  const customersQuery = useQuery({
    queryKey: queryKeys.customers.list(currentQuery),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<CustomerListData, CustomerListMeta>(
        API_PATHS.customers,
        {
          query: buildCustomerListRequestQuery(currentQuery),
          signal
        }
      );

      return response;
    }
  });

  const customerItems = customersQuery.data?.data.items ?? [];
  const customerMeta = customersQuery.data?.meta;
  const isInitialLoading = customersQuery.isPending;
  const hasActiveFilters =
    !isDefaultFilterState(draftFilters) || currentQuery.page !== DEFAULT_QUERY.page;

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const pageSize = currentQuery.pageSize ?? DEFAULT_QUERY.pageSize;
    const nextQuery = normalizeCustomerListQuery({
      keyword: draftFilters.keyword || undefined,
      page: DEFAULT_QUERY.page,
      pageSize,
      sortBy: draftFilters.sortBy,
      sortOrder: draftFilters.sortOrder
    });

    setSearchParams(buildSearchParams(toFilterState(nextQuery), pageSize, DEFAULT_QUERY.page));
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTER_STATE);
    setSearchParams(
      buildSearchParams(DEFAULT_FILTER_STATE, currentQuery.pageSize ?? DEFAULT_PAGE_SIZE, 1)
    );
  };

  const movePage = (nextPage: number) => {
    setSearchParams(
      buildSearchParams(
        toFilterState(currentQuery),
        currentQuery.pageSize ?? DEFAULT_PAGE_SIZE,
        nextPage
      )
    );
  };

  if (isInitialLoading) {
    return (
      <section className="management-page customer-list-page" aria-labelledby="customers-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <div className="customer-list-page__header-row">
            <div>
              <h1 id="customers-title">顧客一覧</h1>
              <p className="management-page__lead">
                顧客を検索し、最終購入情報と購入回数をひと目で確認できます。
              </p>
            </div>
            <Link className="primary-button button-link" to="/customers/new">
              顧客登録
            </Link>
          </div>
        </div>
        <div className="management-page__status" role="status">
          顧客一覧を読み込んでいます...
        </div>
      </section>
    );
  }

  if (customersQuery.isError) {
    return (
      <section className="management-page customer-list-page" aria-labelledby="customers-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <div className="customer-list-page__header-row">
            <div>
              <h1 id="customers-title">顧客一覧</h1>
              <p className="management-page__lead">
                顧客を検索し、最終購入情報と購入回数をひと目で確認できます。
              </p>
            </div>
            <Link className="primary-button button-link" to="/customers/new">
              顧客登録
            </Link>
          </div>
        </div>
        <div className="management-page__notice is-error" role="alert">
          <p>
            {getErrorMessage(
              customersQuery.error,
              "顧客一覧を取得できませんでした。"
            )}
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void customersQuery.refetch();
            }}
          >
            再試行
          </button>
        </div>
      </section>
    );
  }

  const totalCount = customerMeta?.totalCount ?? customerItems.length;
  const currentPage = customerMeta?.page ?? currentQuery.page ?? DEFAULT_QUERY.page;
  const pageSize = customerMeta?.pageSize ?? currentQuery.pageSize ?? DEFAULT_PAGE_SIZE;
  const lastPage = Math.max(Math.ceil(totalCount / pageSize), 1);
  const canGoPrevious = currentPage > 1;
  const canGoNext = customerMeta?.hasNext ?? false;

  return (
    <section className="management-page customer-list-page" aria-labelledby="customers-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div className="customer-list-page__header-row">
          <div>
            <h1 id="customers-title">顧客一覧</h1>
            <p className="management-page__lead">
              顧客を検索し、最終購入情報と購入回数をひと目で確認できます。
            </p>
          </div>
          <Link className="primary-button button-link" to="/customers/new">
            顧客登録
          </Link>
        </div>
        {customersQuery.isFetching ? (
          <p className="management-page__sync" role="status">
            最新の一覧を更新中です...
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

      <section className="management-page__section" aria-labelledby="customer-filters-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="customer-filters-title" className="management-page__section-title">
              検索条件
            </h2>
            <p className="management-page__section-summary">
              顧客名、SNSアカウント、メモを対象に検索できます。
            </p>
          </div>
        </div>
        <form className="management-form customer-list-filters" noValidate onSubmit={applyFilters}>
          <div className="management-form__grid">
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="customer-keyword">
                キーワード
              </label>
              <input
                id="customer-keyword"
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
              <label className="auth-field__label" htmlFor="customer-sort-by">
                並び順
              </label>
              <select
                id="customer-sort-by"
                className="auth-field__input"
                value={draftFilters.sortBy}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setDraftFilters((current) => ({
                    ...current,
                    sortBy: event.target.value as CustomerSortBy
                  }))
                }
              >
                <option value="updatedAt">更新日</option>
                <option value="lastPurchaseAt">最終購入日</option>
                <option value="name">顧客名</option>
              </select>
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="customer-sort-order">
                並び順序
              </label>
              <select
                id="customer-sort-order"
                className="auth-field__input"
                value={draftFilters.sortOrder}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
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

      <section className="management-page__section" aria-labelledby="customer-list-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="customer-list-title" className="management-page__section-title">
              顧客一覧
            </h2>
            <p className="management-page__section-summary">
              顧客名、最終購入日、最終購入商品、購入回数を一覧で確認できます。
            </p>
          </div>
          <p className="management-page__sync" role="status">
            {currentPage} / {lastPage}
          </p>
        </div>

        {customerItems.length === 0 ? (
          <div className="management-page__empty">
            <p>条件に一致する顧客はありません。</p>
            <div className="management-form__actions">
              <button className="secondary-button" type="button" onClick={clearFilters}>
                条件をクリア
              </button>
              <Link className="primary-button button-link" to="/customers/new">
                顧客登録
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="management-list" role="list">
              {customerItems.map((customer) => (
                <Link
                  key={customer.customerId}
                  aria-labelledby={`customer-name-${customer.customerId}`}
                  className="management-card customer-list-card"
                  role="listitem"
                  to={`/customers/${customer.customerId}`}
                >
                  <div className="management-card__header">
                    <div>
                      <p className="customer-list-card__customer-id">{customer.customerId}</p>
                      <h3
                        id={`customer-name-${customer.customerId}`}
                        className="management-card__title"
                      >
                        {customer.name}
                      </h3>
                    </div>
                  </div>

                  <dl className="management-card__details customer-list-card__details">
                    <div>
                      <dt>最終購入日</dt>
                      <dd>{formatLastPurchaseAt(customer.lastPurchaseAt)}</dd>
                    </div>
                    <div>
                      <dt>最終購入商品</dt>
                      <dd>{customer.lastPurchaseProductName ?? "購入商品なし"}</dd>
                    </div>
                    <div>
                      <dt>購入回数</dt>
                      <dd>{`${customer.purchaseCount}件`}</dd>
                    </div>
                  </dl>
                </Link>
              ))}
            </div>

            <div className="customer-list-pagination" aria-label="ページング">
              <button
                className="secondary-button"
                disabled={!canGoPrevious}
                type="button"
                onClick={() => movePage(currentPage - 1)}
              >
                前へ
              </button>
              <p className="customer-list-pagination__status">
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
