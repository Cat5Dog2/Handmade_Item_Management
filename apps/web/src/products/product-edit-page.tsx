import type {
  CategoryListData,
  CustomerListData,
  ApiErrorCode,
  ProductDetailData,
  ProductImageDetail,
  ProductImageMutationData,
  ProductUpdateData,
  ProductUpdateInput,
  TagListData
} from "@handmade/shared";
import {
  API_PATHS,
  getProductImagePath,
  getProductImagesPath,
  getProductPath,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  productUpdateInputSchema
} from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { z } from "zod";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import {
  getProductFormFieldErrorMessage,
  type ProductFormFieldName
} from "../api/field-error-messages";
import { useApiClient } from "../api/api-client-context";
import { mapApiErrorToUi, type UiApiError } from "../api/map-api-error-to-ui";
import { queryKeys } from "../api/query-keys";
import {
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import { useZodForm } from "../forms/use-zod-form";
import {
  APP_NAME,
  PRODUCT_ERROR_MESSAGES,
  PRODUCT_FORM_ERROR_MESSAGE_OVERRIDES,
  PRODUCT_IMAGE_ERROR_MESSAGES,
  PRODUCT_IMAGE_ERROR_MESSAGE_OVERRIDES
} from "../messages/display-messages";

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
  | "primaryImageId"
  | "soldCustomerId";

const SOLD_ROLLBACK_CONFIRM_MESSAGE =
  "販売済からステータスを戻すと販売日時が解除されます。よろしいですか？";

const customerSelectQuery = {
  page: 1,
  pageSize: 100,
  sortBy: "name",
  sortOrder: "asc"
} as const;

const PRODUCT_IMAGE_MAX_COUNT = 10;
const IMAGE_MUTATION_FALLBACK_MESSAGE_CODES: ApiErrorCode[] = [
  "INTERNAL_ERROR",
  "VALIDATION_ERROR"
];

type ProductImageUploadAction =
  | { kind: "create" }
  | { imageId: string; kind: "replace" };

type ProductImageUploadInput = ProductImageUploadAction & {
  file: File;
};

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

function selectPrimaryImage(images: ProductImageDetail[]) {
  return (
    images.find((image) => image.isPrimary) ??
    [...images].sort((left, right) => left.sortOrder - right.sortOrder)[0] ??
    null
  );
}

function sortImages(images: ProductImageDetail[]) {
  return [...images].sort((left, right) => left.sortOrder - right.sortOrder);
}

function createProductImageFormData(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
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
  const productImageUploadInputRef = useRef<HTMLInputElement>(null);
  const pendingProductImageUploadRef = useRef<ProductImageUploadAction | null>(
    null
  );
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

  const productImageMutation = useMutation({
    mutationFn: async (input: ProductImageUploadInput) => {
      if (!productId) {
        throw new Error("Product ID is missing.");
      }

      const body = createProductImageFormData(input.file);

      if (input.kind === "create") {
        const response = await apiClient.post<
          ProductImageMutationData,
          undefined,
          FormData
        >(getProductImagesPath(productId), {
          body
        });

        return response.data;
      }

      const response = await apiClient.put<
        ProductImageMutationData,
        undefined,
        FormData
      >(getProductImagePath(productId, input.imageId), {
        body
      });

      return response.data;
    },
    onSuccess: async () => {
      if (!productId) {
        return;
      }

      await refreshProductQueries(productId);
    }
  });

  const productImageDeleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      if (!productId) {
        throw new Error("Product ID is missing.");
      }

      const response = await apiClient.delete<ProductImageMutationData>(
        getProductImagePath(productId, imageId)
      );

      return response.data;
    },
    onSuccess: async (_, deletedImageId) => {
      if (!productId) {
        return;
      }

      const selectedPrimaryImageId = form.getValues("primaryImageId");
      const remainingImages = sortImages(
        productDetailQuery.data?.images ?? []
      ).filter((image) => image.imageId !== deletedImageId);

      if (
        selectedPrimaryImageId &&
        !remainingImages.some((image) => image.imageId === selectedPrimaryImageId)
      ) {
        form.setValue("primaryImageId", remainingImages[0]?.imageId ?? null, {
          shouldDirty: false,
          shouldValidate: true
        });
      }

      await refreshProductQueries(productId);
    }
  });

  const applyFormApiErrors = useCallback(
    (error: UiApiError) => {
      if (error.code !== "VALIDATION_ERROR") {
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
          detail.field === "primaryImageId" ||
          detail.field === "soldCustomerId"
        ) {
          const fieldName = detail.field as ProductFormFieldName;

          form.setError(detail.field as ProductUpdateFieldName, {
            message: getProductFormFieldErrorMessage(fieldName, detail.message),
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
          message: PRODUCT_ERROR_MESSAGES.notFound,
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
        const uiError = mapApiErrorToUi(error, {
          codeMessages: PRODUCT_FORM_ERROR_MESSAGE_OVERRIDES,
          fallbackMessage: PRODUCT_ERROR_MESSAGES.updateFailed
        });
        const hasFieldError = applyFormApiErrors(uiError);

        if (!hasFieldError) {
          setNotice({
            message: uiError.message,
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

  const handleStartImageUpload = (
    action: ProductImageUploadAction,
    canAddImage = true
  ) => {
    if (action.kind === "create" && !canAddImage) {
      return;
    }

    pendingProductImageUploadRef.current = action;
    setNotice(null);
    productImageUploadInputRef.current?.click();
  };

  const handleImageUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const action = pendingProductImageUploadRef.current;
    const file = event.currentTarget.files?.[0];

    pendingProductImageUploadRef.current = null;
    event.currentTarget.value = "";

    if (!action || !file) {
      return;
    }

    setNotice(null);

    try {
      await productImageMutation.mutateAsync({
        ...action,
        file
      });
    } catch (error) {
      setNotice({
        message: getApiErrorDisplayMessage(error, {
          codeMessages: PRODUCT_IMAGE_ERROR_MESSAGE_OVERRIDES,
          fallbackMessage:
            action.kind === "create"
              ? PRODUCT_IMAGE_ERROR_MESSAGES.addFailed
              : PRODUCT_IMAGE_ERROR_MESSAGES.replaceFailed,
          fallbackMessageCodes: IMAGE_MUTATION_FALLBACK_MESSAGE_CODES
        }),
        type: "error"
      });
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    setNotice(null);

    try {
      await productImageDeleteMutation.mutateAsync(imageId);
    } catch (error) {
      setNotice({
        message: getApiErrorDisplayMessage(error, {
          codeMessages: PRODUCT_IMAGE_ERROR_MESSAGE_OVERRIDES,
          fallbackMessage: PRODUCT_IMAGE_ERROR_MESSAGES.deleteFailed,
          fallbackMessageCodes: IMAGE_MUTATION_FALLBACK_MESSAGE_CODES
        }),
        type: "error"
      });
    }
  };

  const categories = categoriesQuery.data?.items ?? [];
  const tags = tagsQuery.data?.items ?? [];
  const customers = customersQuery.data?.items ?? [];
  const product = productDetailQuery.data?.product;
  const sortedImages = useMemo(
    () => sortImages(productDetailQuery.data?.images ?? []),
    [productDetailQuery.data?.images]
  );
  const hasImageCapacity = sortedImages.length < PRODUCT_IMAGE_MAX_COUNT;
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
  const isPageBusy =
    isLookupFetching ||
    updateProductMutation.isPending ||
    productImageMutation.isPending ||
    productImageDeleteMutation.isPending;
  const imageUploadStatus = productImageMutation.isPending
    ? productImageMutation.variables?.kind === "create"
      ? "画像を追加しています..."
      : "画像を差し替えています..."
    : null;
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
        <ScreenLoadingState message="商品編集に必要な情報を読み込んでいます..." />
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
        <ScreenErrorState
          message={getApiErrorDisplayMessage(lookupError, {
            codeMessages: PRODUCT_FORM_ERROR_MESSAGE_OVERRIDES,
            fallbackMessage: PRODUCT_ERROR_MESSAGES.editLookupFailed
          })}
          onRetry={retryLookups}
        />
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
        {imageUploadStatus ? (
          <p className="management-page__sync" role="status">
            {imageUploadStatus}
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

      <section className="management-page__section" aria-labelledby="product-edit-images-title">
        <div className="management-page__section-header">
          <div>
            <h2
              id="product-edit-images-title"
              className="management-page__section-title"
            >
              画像
            </h2>
            <p className="management-page__section-summary">
              商品画像の追加と差し替えを行います。最大10枚まで登録できます。
            </p>
          </div>
          <button
            className="primary-button"
            disabled={isPageBusy || !hasImageCapacity}
            type="button"
            onClick={() => {
              handleStartImageUpload({ kind: "create" }, hasImageCapacity);
            }}
          >
            画像を追加
          </button>
        </div>
        <p className="management-form__hint">
          JPEG、PNG、WebP 形式の10MB以下の画像を選択してください。
          {hasImageCapacity
            ? ` あと${PRODUCT_IMAGE_MAX_COUNT - sortedImages.length}枚追加できます。`
            : " 画像は10枚登録済みです。不要な画像を削除してから追加してください。"}
        </p>
        {sortedImages.length > 0 ? (
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="product-primary-image">
              代表画像
            </label>
            <select
              {...form.register("primaryImageId")}
              id="product-primary-image"
              className="auth-field__input"
              aria-invalid={Boolean(formErrors.primaryImageId)}
              disabled={isPageBusy}
            >
              <option value="">代表画像なし</option>
              {sortedImages.map((image) => (
                <option key={image.imageId} value={image.imageId}>
                  {`画像 ${image.sortOrder}`}
                </option>
              ))}
            </select>
            {formErrors.primaryImageId ? (
              <p className="auth-field__error" role="alert">
                {formErrors.primaryImageId.message}
              </p>
            ) : (
              <p className="management-form__hint">変更は更新ボタンで保存されます。</p>
            )}
          </div>
        ) : null}
        {sortedImages.length === 0 ? (
          <div className="management-card">
            <p className="management-form__hint">
              画像はまだ登録されていません。上の追加ボタンから登録してください。
            </p>
          </div>
        ) : (
          <div className="management-list" role="list">
            {sortedImages.map((image) => (
              <article
                key={image.imageId}
                className="management-card"
                role="listitem"
              >
                <div className="management-card__header">
                  <div>
                    <p className="management-card__subtitle">
                      {image.isPrimary ? "代表画像" : "通常画像"}
                    </p>
                    <h3 className="management-card__title">{`画像 ${image.sortOrder}`}</h3>
                  </div>
                  <span className="management-badge is-idle">{image.imageId}</span>
                </div>
                <div className="product-detail-page__image">
                  <img
                    alt={`${product.name} の画像 ${image.sortOrder}`}
                    className="product-detail-page__image-element"
                    src={image.thumbnailUrl}
                  />
                </div>
                <dl className="management-card__details">
                  <div>
                    <dt>画像ID</dt>
                    <dd>{image.imageId}</dd>
                  </div>
                  <div>
                    <dt>並び順</dt>
                    <dd>{`${image.sortOrder}番目`}</dd>
                  </div>
                  <div>
                    <dt>代表画像</dt>
                    <dd>{image.isPrimary ? "はい" : "いいえ"}</dd>
                  </div>
                </dl>
                <div className="management-card__actions">
                  <button
                    className="secondary-button"
                    disabled={isPageBusy}
                    type="button"
                    aria-label={`${product.name} の画像 ${image.sortOrder} を差し替える`}
                    onClick={() => {
                      handleStartImageUpload({
                        imageId: image.imageId,
                        kind: "replace"
                      });
                    }}
                  >
                    差し替え
                  </button>
                  <button
                    className="danger-button"
                    disabled={isPageBusy}
                    type="button"
                    aria-label={`${product.name} の画像 ${image.sortOrder} (${image.imageId}) を削除する`}
                    onClick={() => {
                      void handleDeleteImage(image.imageId);
                    }}
                  >
                    削除する
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <input
          ref={productImageUploadInputRef}
          accept="image/jpeg,image/png,image/webp"
          aria-label="商品画像ファイルを選択"
          data-testid="product-image-upload-input"
          hidden
          type="file"
          onChange={(event) => {
            void handleImageUploadChange(event);
          }}
        />
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
