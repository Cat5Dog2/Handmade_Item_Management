import type {
  CategoryListData,
  ProductCreateData,
  ProductCreateInput,
  TagListData
} from "@handmade/shared";
import {
  API_PATHS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  getProductPath,
  productCreateInputSchema
} from "@handmade/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiClientError } from "../api/api-client";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import {
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import { useZodForm } from "../forms/use-zod-form";
import { APP_NAME, PRODUCT_ERROR_MESSAGES } from "../messages/display-messages";

interface PageNotice {
  message: string;
  type: "error";
}

type ProductCreateFieldName =
  | "name"
  | "description"
  | "price"
  | "categoryId"
  | "tagIds"
  | "status";

const defaultProductFormValues = {
  categoryId: "",
  description: "",
  name: "",
  price: "",
  status: "" as unknown as ProductCreateInput["status"],
  tagIds: []
};

export function ProductCreatePage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const form = useZodForm(productCreateInputSchema, {
    defaultValues: defaultProductFormValues,
    mode: "onChange"
  });

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

  const createProductMutation = useMutation({
    mutationFn: async (input: ProductCreateInput) => {
      const response = await apiClient.post<
        ProductCreateData,
        undefined,
        ProductCreateInput
      >(API_PATHS.products, {
        body: input
      });

      return response.data;
    }
  });

  const isLookupLoading = categoriesQuery.isPending || tagsQuery.isPending;
  const isLookupFetching = categoriesQuery.isFetching || tagsQuery.isFetching;
  const lookupError = categoriesQuery.error ?? tagsQuery.error;
  const isPageBusy = isLookupFetching || createProductMutation.isPending;
  const categories = categoriesQuery.data?.items ?? [];
  const tags = tagsQuery.data?.items ?? [];

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
          detail.field === "status"
        ) {
          form.setError(detail.field as ProductCreateFieldName, {
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

  const handleProductSubmit = form.handleSubmit(async (values) => {
    setNotice(null);
    form.clearErrors();

    try {
      const result = await createProductMutation.mutateAsync(values);
      navigate(getProductPath(result.productId), { replace: true });
    } catch (error) {
      const hasFieldError = applyFormApiErrors(error);

      if (!hasFieldError) {
        setNotice({
          message: getApiErrorDisplayMessage(error, {
            fallbackMessage: PRODUCT_ERROR_MESSAGES.createFailed
          }),
          type: "error"
        });
      }
    }
  });

  if (isLookupLoading) {
    return (
      <section className="management-page product-create-page" aria-labelledby="product-create-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="product-create-title">商品登録</h1>
          <p className="management-page__lead">
            商品の基本情報を登録します。画像は保存後に追加できます。
          </p>
        </div>
        <ScreenLoadingState message="カテゴリとタグを読み込んでいます..." />
      </section>
    );
  }

  if (lookupError) {
    return (
      <section className="management-page product-create-page" aria-labelledby="product-create-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="product-create-title">商品登録</h1>
          <p className="management-page__lead">
            商品の基本情報を登録します。画像は保存後に追加できます。
          </p>
        </div>
        <ScreenErrorState
          message="カテゴリまたはタグを読み込めませんでした。再試行してください。"
          onRetry={() => {
            void Promise.all([categoriesQuery.refetch(), tagsQuery.refetch()]);
          }}
        />
      </section>
    );
  }

  return (
    <section className="management-page product-create-page" aria-labelledby="product-create-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <h1 id="product-create-title">商品登録</h1>
        <p className="management-page__lead">
          商品の基本情報を登録します。画像は保存後に追加できます。
        </p>
        {isLookupFetching ? (
          <p className="management-page__sync" role="status">
            カテゴリとタグを更新中...
          </p>
        ) : null}
        {notice ? (
          <div className="management-page__notice is-error" role="alert">
            <p>{notice.message}</p>
          </div>
        ) : null}
      </div>

      <section className="management-page__section" aria-labelledby="product-create-form-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="product-create-form-title" className="management-page__section-title">
              基本情報
            </h2>
            <p className="management-page__section-summary">
              商品名、価格、カテゴリ、ステータスを入力して登録します。
            </p>
          </div>
        </div>

        <form className="management-form product-create-form" noValidate onSubmit={handleProductSubmit}>
          <div className="management-form__grid">
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="product-name">
                商品名
              </label>
              <input
                {...form.register("name")}
                id="product-name"
                className="auth-field__input"
                aria-invalid={Boolean(form.formState.errors.name)}
                disabled={isPageBusy}
                type="text"
              />
              {form.formState.errors.name ? (
                <p className="auth-field__error" role="alert">
                  {form.formState.errors.name.message}
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
                aria-invalid={Boolean(form.formState.errors.price)}
                disabled={isPageBusy}
                inputMode="numeric"
                min={0}
                step={1}
                type="number"
              />
              {form.formState.errors.price ? (
                <p className="auth-field__error" role="alert">
                  {form.formState.errors.price.message}
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
                aria-invalid={Boolean(form.formState.errors.categoryId)}
                disabled={isPageBusy}
              >
                <option value="">選択してください</option>
                {categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.categoryId ? (
                <p className="auth-field__error" role="alert">
                  {form.formState.errors.categoryId.message}
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
                aria-invalid={Boolean(form.formState.errors.status)}
                disabled={isPageBusy}
              >
                <option value="">選択してください</option>
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PRODUCT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              {form.formState.errors.status ? (
                <p className="auth-field__error" role="alert">
                  {form.formState.errors.status.message}
                </p>
              ) : null}
            </div>

            <div className="auth-field product-create-form__description">
              <label className="auth-field__label" htmlFor="product-description">
                商品説明
              </label>
              <textarea
                {...form.register("description")}
                id="product-description"
                className="auth-field__input product-create-page__textarea"
                aria-invalid={Boolean(form.formState.errors.description)}
                disabled={isPageBusy}
                rows={5}
              />
              {form.formState.errors.description ? (
                <p className="auth-field__error" role="alert">
                  {form.formState.errors.description.message}
                </p>
              ) : (
                <p className="management-form__hint">最大2,000文字です。未入力でも登録できます。</p>
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
                        aria-invalid={Boolean(form.formState.errors.tagIds)}
                        disabled={isPageBusy}
                        type="checkbox"
                        value={tag.tagId}
                      />
                      <span>{tag.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {form.formState.errors.tagIds ? (
                <p className="auth-field__error" role="alert">
                  {form.formState.errors.tagIds.message}
                </p>
              ) : (
                <p className="management-form__hint">複数選択できます。</p>
              )}
            </fieldset>

            <p className="management-form__hint product-create-page__note">
              この画面では画像は登録しません。保存後に詳細画面で追加できます。
            </p>
          </div>

          <div className="management-form__actions">
            <button
              className="primary-button"
              disabled={isPageBusy}
              type="submit"
            >
              {createProductMutation.isPending ? "登録中..." : "登録する"}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
