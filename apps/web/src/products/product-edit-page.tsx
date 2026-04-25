import type {
  CategoryListData,
  CustomerListData,
  ProductDetailData,
  ProductImageDetail,
  ProductUpdateData,
  ProductUpdateInput,
  TagListData
} from "@handmade/shared";
import {
  API_PATHS,
  getProductPath,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  productUpdateInputSchema
} from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { z } from "zod";
import { ApiClientError } from "../api/api-client";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import { useZodForm } from "../forms/use-zod-form";

interface PageNotice {
  message: string;
  type: "error";
}

type ProductUpdateFormInput = z.input<typeof productUpdateInputSchema>;

type ProductUpdateFieldName =
  | "name"
  | "description"
  | "price"
  | "categoryId"
  | "tagIds"
  | "status"
  | "soldCustomerId";

const APP_NAME = "Handmade Item Management";
const PRODUCT_EDIT_ERROR_MESSAGE =
  "商品編集に必要な情報を取得できませんでした。再試行してください。";
const PRODUCT_UPDATE_ERROR_MESSAGE = "商品を更新できませんでした。";
const PRODUCT_NOT_FOUND_MESSAGE = "対象の商品が見つかりません。";
const PRODUCT_DELETED_MESSAGE = "対象の商品は削除済みです。";
const SOLD_ROLLBACK_CONFIRM_MESSAGE =
  "販売済からステータスを戻すと販売日時が解除されます。よろしいですか？";

const customerSelectQuery = {
  page: 1,
  pageSize: 100,
  sortBy: "name",
  sortOrder: "asc"
} as const;

const emptyProductUpdateFormValues: ProductUpdateFormInput = {
  categoryId: "",
  description: "",
  name: "",
  price: "",
  primaryImageId: null,
  soldCustomerId: null,
  status: "" as unknown as ProductUpdateFormInput["status"],
  tagIds: []
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiClientError) {
    if (error.code === "PRODUCT_NOT_FOUND") {
      return PRODUCT_NOT_FOUND_MESSAGE;
    }

    if (error.code === "PRODUCT_DELETED") {
      return PRODUCT_DELETED_MESSAGE;
    }

    return error.message;
  }

  return fallbackMessage;
}

function selectPrimaryImage(images: ProductImageDetail[]) {
  return (
    images.find((image) => image.isPrimary) ??
    [...images].sort((left, right) => left.sortOrder - right.sortOrder)[0] ??
    null
  );
}

function toProductUpdateFormValues(data: ProductDetailData): ProductUpdateFormInput {
  const product = data.product;
  const primaryImage = selectPrimaryImage(data.images);

  return {
    categoryId: product.categoryId,
    description: product.description,
    name: product.name,
    price: product.price,
    primaryImageId: primaryImage?.imageId ?? null,
    soldCustomerId: product.soldCustomerId,
    status: product.status,
    tagIds: product.tagIds
  };
}

export function ProductEditPage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { productId } = useParams();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [initializedProductId, setInitializedProductId] = useState<string | null>(
    null
  );
  const [pendingRollbackInput, setPendingRollbackInput] =
    useState<ProductUpdateInput | null>(null);
  const form = useZodForm(productUpdateInputSchema, {
    defaultValues: emptyProductUpdateFormValues,
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

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<CategoryListData>(API_PATHS.categories, {
        signal
      });

      return response.data;
    }
  });

  const tagsQuery = useQuery({
    queryKey: queryKeys.tags.list,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<TagListData>(API_PATHS.tags, {
        signal
      });

      return response.data;
    }
  });

  const customersQuery = useQuery({
    queryKey: queryKeys.customers.list(customerSelectQuery),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<CustomerListData>(API_PATHS.customers, {
        query: customerSelectQuery,
        signal
      });

      return response.data;
    }
  });

  useEffect(() => {
    if (!productDetailQuery.data) {
      return;
    }

    const nextProductId = productDetailQuery.data.product.productId;

    if (initializedProductId === nextProductId) {
      return;
    }

    form.reset(toProductUpdateFormValues(productDetailQuery.data));
    setInitializedProductId(nextProductId);
  }, [form, initializedProductId, productDetailQuery.data]);

  const selectedStatus = form.watch("status");

  useEffect(() => {
    if (selectedStatus !== "sold") {
      form.setValue("soldCustomerId", null, {
        shouldDirty: false,
        shouldValidate: false
      });
    }
  }, [form, selectedStatus]);

  const refreshProductQueries = useCallback(
    async (updatedProductId: string) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.root
        }),
        queryClient.invalidateQueries({
          queryKey: ["products", "list"]
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(updatedProductId)
        })
      ]);
    },
    [queryClient]
  );

  const updateProductMutation = useMutation({
    mutationFn: async (input: ProductUpdateInput) => {
      const response = await apiClient.put<
        ProductUpdateData,
        undefined,
        ProductUpdateInput
      >(getProductPath(productId ?? ""), {
        body: input
      });

      return response.data;
    },
    onSuccess: async (data) => {
      await refreshProductQueries(data.productId);
    }
  });

  const applyFormApiErrors = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiClientError) || !error.details?.length) {
        return false;
      }

      let applied = false;

      error.details.forEach((detail) => {
        if (
          detail.field === "name" ||
          detail.field === "description" ||
          detail.field === "price" ||
          detail.field === "categoryId" ||
          detail.field === "tagIds" ||
          detail.field === "status" ||
          detail.field === "soldCustomerId"
        ) {
          form.setError(detail.field as ProductUpdateFieldName, {
            message: detail.message,
            type: "server"
          });
          applied = true;
        }
      });

      return applied;
    },
    [form]
  );

  const saveProduct = useCallback(
    async (input: ProductUpdateInput) => {
      if (!productId) {
        setNotice({
          message: PRODUCT_NOT_FOUND_MESSAGE,
          type: "error"
        });
        return;
      }

      setNotice(null);
      form.clearErrors();

      try {
        const result = await updateProductMutation.mutateAsync(input);
        navigate(getProductPath(result.productId), { replace: true });
      } catch (error) {
        const hasFieldError = applyFormApiErrors(error);

        if (!hasFieldError) {
          setNotice({
            message: getErrorMessage(error, PRODUCT_UPDATE_ERROR_MESSAGE),
            type: "error"
          });
        }
      }
    },
    [applyFormApiErrors, form, navigate, productId, updateProductMutation]
  );

  const handleProductSubmit = form.handleSubmit(async (values) => {
    const input: ProductUpdateInput = {
      ...values,
      primaryImageId: values.primaryImageId ?? null,
      soldCustomerId: values.status === "sold" ? values.soldCustomerId ?? null : null,
      tagIds: values.tagIds ?? []
    };
    const originalStatus = productDetailQuery.data?.product.status;

    if (originalStatus === "sold" && input.status !== "sold") {
      setNotice(null);
      form.clearErrors();
      setPendingRollbackInput(input);
      return;
    }

    await saveProduct(input);
  });

  const handleRollbackConfirm = async () => {
    if (!pendingRollbackInput) {
      return;
    }

    const input = pendingRollbackInput;
    setPendingRollbackInput(null);
    await saveProduct(input);
  };

  const handleCancel = () => {
    navigate(productId ? getProductPath(productId) : "/products");
  };

  const categories = categoriesQuery.data?.items ?? [];
  const tags = tagsQuery.data?.items ?? [];
  const customers = customersQuery.data?.items ?? [];
  const product = productDetailQuery.data?.product;
  const lookupError =
    productDetailQuery.error ??
    categoriesQuery.error ??
    tagsQuery.error ??
    customersQuery.error;
  const isInitialLoading =
    productDetailQuery.isPending ||
    categoriesQuery.isPending ||
    tagsQuery.isPending ||
    customersQuery.isPending;
  const isLookupFetching =
    productDetailQuery.isFetching ||
    categoriesQuery.isFetching ||
    tagsQuery.isFetching ||
    customersQuery.isFetching;
  const isPageBusy = isLookupFetching || updateProductMutation.isPending;
  const formErrors = form.formState.errors;
  const shouldShowCustomerSelector = selectedStatus === "sold";

  const retryLookups = useMemo(
    () => () => {
      void Promise.all([
        productDetailQuery.refetch(),
        categoriesQuery.refetch(),
        tagsQuery.refetch(),
        customersQuery.refetch()
      ]);
    },
    [categoriesQuery, customersQuery, productDetailQuery, tagsQuery]
  );

  if (!productId || isInitialLoading) {
    return (
      <section className="management-page product-create-page" aria-labelledby="product-edit-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="product-edit-title">商品編集</h1>
          <p className="management-page__lead">
            商品の基本情報、ステータス、購入者紐付けを更新します。
          </p>
        </div>
        <div className="management-page__status" role="status">
          商品編集に必要な情報を読み込んでいます...
        </div>
      </section>
    );
  }

  if (lookupError || !productDetailQuery.data || !product) {
    return (
      <section className="management-page product-create-page" aria-labelledby="product-edit-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="product-edit-title">商品編集</h1>
          <p className="management-page__lead">
            商品の基本情報、ステータス、購入者紐付けを更新します。
          </p>
        </div>
        <div className="management-page__notice is-error" role="alert">
          <p>{getErrorMessage(lookupError, PRODUCT_EDIT_ERROR_MESSAGE)}</p>
          <button className="secondary-button" type="button" onClick={retryLookups}>
            再試行
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="management-page product-create-page" aria-labelledby="product-edit-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <h1 id="product-edit-title">商品編集</h1>
        <p className="management-page__lead">
          商品の基本情報、ステータス、購入者紐付けを更新します。
        </p>
        {isLookupFetching ? (
          <p className="management-page__sync" role="status">
            最新の商品情報を更新中...
          </p>
        ) : null}
        {notice ? (
          <div className="management-page__notice is-error" role="alert">
            <p>{notice.message}</p>
          </div>
        ) : null}
      </div>

      <section className="management-page__section" aria-labelledby="product-edit-form-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="product-edit-form-title" className="management-page__section-title">
              基本情報
            </h2>
            <p className="management-page__section-summary">
              商品名、価格、カテゴリ、タグ、ステータスを最新の内容へ更新します。
            </p>
          </div>
        </div>

        <form className="management-form product-create-form" noValidate onSubmit={handleProductSubmit}>
          <div className="management-form__grid">
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-id">
                商品ID
              </label>
              <input
                id="product-id"
                className="auth-field__input"
                disabled
                readOnly
                type="text"
                value={product.productId}
              />
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-name">
                商品名
              </label>
              <input
                {...form.register("name")}
                id="product-name"
                className="auth-field__input"
                aria-invalid={Boolean(formErrors.name)}
                disabled={isPageBusy}
                type="text"
              />
              {formErrors.name ? (
                <p className="auth-field__error" role="alert">
                  {formErrors.name.message}
                </p>
              ) : null}
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-price">
                価格
              </label>
              <input
                {...form.register("price")}
                id="product-price"
                className="auth-field__input"
                aria-invalid={Boolean(formErrors.price)}
                disabled={isPageBusy}
                inputMode="numeric"
                min={0}
                step={1}
                type="number"
              />
              {formErrors.price ? (
                <p className="auth-field__error" role="alert">
                  {formErrors.price.message}
                </p>
              ) : null}
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-category">
                カテゴリ
              </label>
              <select
                {...form.register("categoryId")}
                id="product-category"
                className="auth-field__input"
                aria-invalid={Boolean(formErrors.categoryId)}
                disabled={isPageBusy}
              >
                <option value="">選択してください</option>
                {categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.name}
                  </option>
                ))}
              </select>
              {formErrors.categoryId ? (
                <p className="auth-field__error" role="alert">
                  {formErrors.categoryId.message}
                </p>
              ) : categories.length === 0 ? (
                <p className="management-form__hint">カテゴリがありません。先に追加してください。</p>
              ) : null}
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-status">
                ステータス
              </label>
              <select
                {...form.register("status")}
                id="product-status"
                className="auth-field__input"
                aria-invalid={Boolean(formErrors.status)}
                disabled={isPageBusy}
              >
                <option value="">選択してください</option>
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PRODUCT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              {formErrors.status ? (
                <p className="auth-field__error" role="alert">
                  {formErrors.status.message}
                </p>
              ) : null}
            </div>

            {shouldShowCustomerSelector ? (
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="sold-customer">
                  購入者
                </label>
                <select
                  {...form.register("soldCustomerId")}
                  id="sold-customer"
                  className="auth-field__input"
                  aria-invalid={Boolean(formErrors.soldCustomerId)}
                  disabled={isPageBusy}
                >
                  <option value="">紐付けなし</option>
                  {customers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {formErrors.soldCustomerId ? (
                  <p className="auth-field__error" role="alert">
                    {formErrors.soldCustomerId.message}
                  </p>
                ) : customers.length === 0 ? (
                  <p className="management-form__hint">登録済みの顧客がありません。</p>
                ) : (
                  <p className="management-form__hint">未選択でも販売済として保存できます。</p>
                )}
              </div>
            ) : null}

            <div className="auth-field product-create-form__description">
              <label className="auth-field__label" htmlFor="product-description">
                商品説明
              </label>
              <textarea
                {...form.register("description")}
                id="product-description"
                className="auth-field__input product-create-page__textarea"
                aria-invalid={Boolean(formErrors.description)}
                disabled={isPageBusy}
                rows={5}
              />
              {formErrors.description ? (
                <p className="auth-field__error" role="alert">
                  {formErrors.description.message}
                </p>
              ) : (
                <p className="management-form__hint">最大2,000文字です。</p>
              )}
            </div>

            <fieldset className="product-create-page__tag-group">
              <legend className="auth-field__label">タグ</legend>
              {tags.length === 0 ? (
                <p className="management-form__hint">タグはまだありません。</p>
              ) : (
                <div className="product-create-page__tag-options">
                  {tags.map((tag) => (
                    <label
                      key={tag.tagId}
                      className="product-create-page__tag-option"
                      htmlFor={`product-tag-${tag.tagId}`}
                    >
                      <input
                        {...form.register("tagIds")}
                        id={`product-tag-${tag.tagId}`}
                        aria-invalid={Boolean(formErrors.tagIds)}
                        disabled={isPageBusy}
                        type="checkbox"
                        value={tag.tagId}
                      />
                      <span>{tag.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {formErrors.tagIds ? (
                <p className="auth-field__error" role="alert">
                  {formErrors.tagIds.message}
                </p>
              ) : (
                <p className="management-form__hint">複数選択できます。</p>
              )}
            </fieldset>
          </div>

          <div className="management-form__actions">
            <button
              className="primary-button"
              disabled={isPageBusy}
              type="submit"
            >
              {updateProductMutation.isPending ? "更新中..." : "更新する"}
            </button>
            <button
              className="secondary-button"
              disabled={isPageBusy}
              type="button"
              onClick={handleCancel}
            >
              キャンセル
            </button>
          </div>
        </form>
      </section>

      {pendingRollbackInput ? (
        <div className="app-dialog__backdrop" role="presentation">
          <section
            aria-labelledby="sold-rollback-title"
            aria-modal="true"
            className="app-dialog"
            role="dialog"
          >
            <h2 id="sold-rollback-title">販売済戻し確認</h2>
            <p className="app-dialog__summary">{SOLD_ROLLBACK_CONFIRM_MESSAGE}</p>
            <div className="app-dialog__actions">
              <button
                className="secondary-button"
                disabled={updateProductMutation.isPending}
                type="button"
                onClick={() => setPendingRollbackInput(null)}
              >
                キャンセル
              </button>
              <button
                className="primary-button"
                disabled={updateProductMutation.isPending}
                type="button"
                onClick={() => {
                  void handleRollbackConfirm();
                }}
              >
                更新する
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
