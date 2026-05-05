import type {
  CategoryInput,
  CategoryItem,
  CategoryListData,
  CategoryMutationData
} from "@handmade/shared";
import {
  API_PATHS,
  categoryInputSchema,
  getCategoryPath
} from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  getCategoryFormFieldErrorMessage,
  type CategoryFormFieldName
} from "../api/field-error-messages";
import { useApiClient } from "../api/api-client-context";
import { mapApiErrorToUi, type UiApiError } from "../api/map-api-error-to-ui";
import { queryKeys } from "../api/query-keys";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import { useZodForm } from "../forms/use-zod-form";
import {
  APP_NAME,
  CATEGORY_ERROR_MESSAGE_OVERRIDES,
  CATEGORY_ERROR_MESSAGES
} from "../messages/display-messages";

interface PageNotice {
  message: string;
  type: "error" | "success";
}

const defaultCategoryFormValues: CategoryInput = {
  name: "",
  sortOrder: null
};

const updatedAtFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeZone: "Asia/Tokyo",
  timeStyle: "short"
});

function formatUpdatedAt(updatedAt: string) {
  return updatedAtFormatter.format(new Date(updatedAt));
}

function formatUsageLabel(category: CategoryItem) {
  if (category.isInUse) {
    return `使用中 (${category.usedProductCount}件)`;
  }

  return "未使用";
}

export function CategoryManagementPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(
    null
  );
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] =
    useState<CategoryItem | null>(null);
  const categoryForm = useZodForm(categoryInputSchema, {
    defaultValues: defaultCategoryFormValues,
    mode: "onChange"
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list,
    queryFn: async () => {
      const response = await apiClient.get<CategoryListData>(API_PATHS.categories);

      return response.data;
    }
  });

  const refreshCategories = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.categories.list
    });
  }, [queryClient]);

  const resetCategoryForm = useCallback(() => {
    setEditingCategory(null);
    categoryForm.clearErrors();
    categoryForm.reset(defaultCategoryFormValues);
  }, [categoryForm]);

  const applyFormApiErrors = useCallback(
    (error: UiApiError) => {
      if (error.code !== "VALIDATION_ERROR" && error.code !== "DUPLICATE_NAME") {
        return false;
      }

      let applied = false;

      error.details.forEach((detail) => {
        if (detail.field === "name" || detail.field === "sortOrder") {
          const fieldName = detail.field as CategoryFormFieldName;

          categoryForm.setError(detail.field, {
            message:
              fieldName === "name" && error.code === "DUPLICATE_NAME"
                ? error.message
                : getCategoryFormFieldErrorMessage(fieldName, detail.message),
            type: "server"
          });
          applied = true;
        }
      });

      return applied;
    },
    [categoryForm]
  );

  const createCategoryMutation = useMutation({
    mutationFn: async (input: CategoryInput) => {
      const response = await apiClient.post<
        CategoryMutationData,
        undefined,
        CategoryInput
      >(API_PATHS.categories, {
        body: input
      });

      return response.data;
    },
    onSuccess: refreshCategories
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      categoryId,
      input
    }: {
      categoryId: string;
      input: CategoryInput;
    }) => {
      const response = await apiClient.put<
        CategoryMutationData,
        undefined,
        CategoryInput
      >(getCategoryPath(categoryId), {
        body: input
      });

      return response.data;
    },
    onSuccess: refreshCategories
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await apiClient.delete<CategoryMutationData>(
        getCategoryPath(categoryId)
      );

      return response.data;
    },
    onSuccess: refreshCategories
  });

  const isPageBusy =
    categoriesQuery.isFetching ||
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    deleteCategoryMutation.isPending;

  const handleEditStart = (category: CategoryItem) => {
    setNotice(null);
    setEditingCategory(category);
    categoryForm.clearErrors();
    categoryForm.reset({
      name: category.name,
      sortOrder: category.sortOrder
    });
  };

  const handleCategorySubmit = categoryForm.handleSubmit(async (values) => {
    setNotice(null);
    categoryForm.clearErrors();

    if (!editingCategory) {
      try {
        await createCategoryMutation.mutateAsync(values);
        resetCategoryForm();
        setNotice({
          message: "カテゴリを登録しました。",
          type: "success"
        });
      } catch (error) {
        const uiError = mapApiErrorToUi(error, {
          codeMessages: CATEGORY_ERROR_MESSAGE_OVERRIDES,
          fallbackMessage: CATEGORY_ERROR_MESSAGES.createFailed
        });
        const hasFieldError = applyFormApiErrors(uiError);

        if (!hasFieldError) {
          setNotice({
            message: uiError.message,
            type: "error"
          });
        }
      }

      return;
    }

    try {
      await updateCategoryMutation.mutateAsync({
        categoryId: editingCategory.categoryId,
        input: values
      });
      resetCategoryForm();
      setNotice({
        message: "カテゴリを更新しました。",
        type: "success"
      });
    } catch (error) {
      const uiError = mapApiErrorToUi(error, {
        codeMessages: CATEGORY_ERROR_MESSAGE_OVERRIDES,
        fallbackMessage: CATEGORY_ERROR_MESSAGES.updateFailed
      });
      const hasFieldError = applyFormApiErrors(uiError);

      if (uiError.code === "CATEGORY_NOT_FOUND") {
        resetCategoryForm();
        await refreshCategories();
      }

      if (!hasFieldError) {
        setNotice({
          message: uiError.message,
          type: "error"
        });
      }
    }
  });

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteCategory) {
      return;
    }

    const categoryToDelete = pendingDeleteCategory;

    setNotice(null);

    try {
      await deleteCategoryMutation.mutateAsync(categoryToDelete.categoryId);
      setPendingDeleteCategory(null);

      if (editingCategory?.categoryId === categoryToDelete.categoryId) {
        resetCategoryForm();
      }

      setNotice({
        message: "カテゴリを削除しました。",
        type: "success"
      });
    } catch (error) {
      setPendingDeleteCategory(null);

      const uiError = mapApiErrorToUi(error, {
        codeMessages: CATEGORY_ERROR_MESSAGE_OVERRIDES,
        fallbackMessage: CATEGORY_ERROR_MESSAGES.deleteFailed
      });

      if (uiError.code === "CATEGORY_NOT_FOUND") {
        if (editingCategory?.categoryId === categoryToDelete.categoryId) {
          resetCategoryForm();
        }

        await refreshCategories();
      }

      setNotice({
        message: uiError.message,
        type: "error"
      });
    }
  };

  if (categoriesQuery.isPending) {
    return (
      <section className="management-page" aria-labelledby="categories-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="categories-title">カテゴリ管理</h1>
          <p className="management-page__lead">
            一覧の確認と、新規登録、更新、未使用カテゴリの削除をまとめて進めます。
          </p>
        </div>
        <ScreenLoadingState message="カテゴリ一覧を読み込んでいます..." />
      </section>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <section className="management-page" aria-labelledby="categories-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="categories-title">カテゴリ管理</h1>
          <p className="management-page__lead">
            一覧の確認と、新規登録、更新、未使用カテゴリの削除をまとめて進めます。
          </p>
        </div>
        <ScreenErrorState
          message={CATEGORY_ERROR_MESSAGES.listFetchFailed}
          onRetry={() => {
            void categoriesQuery.refetch();
          }}
        />
      </section>
    );
  }

  const categories = categoriesQuery.data.items;

  return (
    <section className="management-page" aria-labelledby="categories-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <h1 id="categories-title">カテゴリ管理</h1>
        <p className="management-page__lead">
          一覧の確認と、新規登録、更新、未使用カテゴリの削除をまとめて進めます。
        </p>
        {categoriesQuery.isFetching ? (
          <p className="management-page__sync" role="status">
            最新の一覧を更新しています...
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

      <section className="management-page__section" aria-labelledby="category-form-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="category-form-title" className="management-page__section-title">
              {editingCategory ? "カテゴリ更新" : "カテゴリ登録"}
            </h2>
            <p className="management-page__section-summary">
              カテゴリ名は必須です。表示順を空欄にすると末尾へ配置します。
            </p>
          </div>
        </div>
        <form className="management-form" noValidate onSubmit={handleCategorySubmit}>
          <div className="management-form__grid">
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="category-name">
                カテゴリ名
              </label>
              <input
                {...categoryForm.register("name")}
                id="category-name"
                className="auth-field__input"
                disabled={isPageBusy}
                type="text"
              />
              {categoryForm.formState.errors.name ? (
                <p className="auth-field__error" role="alert">
                  {categoryForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="category-sort-order">
                表示順
              </label>
              <input
                {...categoryForm.register("sortOrder", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || value === undefined) {
                      return null;
                    }

                    return Number(value);
                  }
                })}
                id="category-sort-order"
                className="auth-field__input"
                disabled={isPageBusy}
                inputMode="numeric"
                min={0}
                step={1}
                type="number"
              />
              {categoryForm.formState.errors.sortOrder ? (
                <p className="auth-field__error" role="alert">
                  {categoryForm.formState.errors.sortOrder.message}
                </p>
              ) : (
                <p className="management-form__hint">
                  未入力または null の場合は末尾へ移動します。
                </p>
              )}
            </div>
          </div>
          <div className="management-form__actions">
            <button
              className="primary-button"
              disabled={!categoryForm.formState.isValid || isPageBusy}
              type="submit"
            >
              {editingCategory ? "更新する" : "登録する"}
            </button>
            {editingCategory ? (
              <button
                className="secondary-button"
                disabled={isPageBusy}
                type="button"
                onClick={resetCategoryForm}
              >
                キャンセル
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="management-page__section" aria-labelledby="category-list-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="category-list-title" className="management-page__section-title">
              カテゴリ一覧
            </h2>
            <p className="management-page__section-summary">
              表示順、更新日時、使用状態を確認しながら、編集と削除を切り替えます。
            </p>
          </div>
        </div>
        {categories.length === 0 ? (
          <ScreenEmptyState message="カテゴリはまだ登録されていません。最初のカテゴリを登録してください。" />
        ) : (
          <div className="management-list" role="list">
            {categories.map((category) => (
              <article
                key={category.categoryId}
                aria-labelledby={`category-name-${category.categoryId}`}
                className="management-card"
                role="listitem"
              >
                <div className="management-card__header">
                  <div>
                    <h3
                      id={`category-name-${category.categoryId}`}
                      className="management-card__title"
                    >
                      {category.name}
                    </h3>
                    <p className="management-card__subtitle">
                      更新日時: {formatUpdatedAt(category.updatedAt)}
                    </p>
                  </div>
                  <span
                    className={
                      category.isInUse
                        ? "management-badge is-in-use"
                        : "management-badge is-idle"
                    }
                  >
                    {formatUsageLabel(category)}
                  </span>
                </div>
                <dl className="management-card__details">
                  <div>
                    <dt>表示順</dt>
                    <dd>{category.sortOrder}</dd>
                  </div>
                  <div>
                    <dt>参照件数</dt>
                    <dd>{category.usedProductCount}件</dd>
                  </div>
                </dl>
                <div className="management-card__actions">
                  <button
                    className="secondary-button"
                    disabled={isPageBusy}
                    type="button"
                    onClick={() => handleEditStart(category)}
                  >
                    編集する
                  </button>
                  <button
                    className="danger-button"
                    disabled={isPageBusy || category.isInUse}
                    type="button"
                    onClick={() => setPendingDeleteCategory(category)}
                  >
                    削除する
                  </button>
                </div>
                {category.isInUse ? (
                  <p className="management-card__note">
                    使用中のため削除できません。
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {pendingDeleteCategory ? (
        <div className="app-dialog__backdrop" role="presentation">
          <section
            aria-labelledby="category-delete-title"
            aria-modal="true"
            className="app-dialog"
            role="dialog"
          >
            <h2 id="category-delete-title">カテゴリ削除確認</h2>
            <p className="app-dialog__summary">
              「{pendingDeleteCategory.name}」を削除しますか？
              このカテゴリを参照している商品がない場合のみ削除できます。
            </p>
            <div className="app-dialog__actions">
              <button
                className="secondary-button"
                disabled={deleteCategoryMutation.isPending}
                type="button"
                onClick={() => setPendingDeleteCategory(null)}
              >
                キャンセル
              </button>
              <button
                className="danger-button"
                disabled={deleteCategoryMutation.isPending}
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
