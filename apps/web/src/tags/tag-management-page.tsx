import type {
  TagInput,
  TagItem,
  TagListData,
  TagMutationData
} from "@handmade/shared";
import { API_PATHS, getTagPath, tagInputSchema } from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { ApiClientError } from "../api/api-client";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import { useZodForm } from "../forms/use-zod-form";

interface PageNotice {
  message: string;
  type: "error" | "success";
}

const defaultTagFormValues: TagInput = {
  name: ""
};

const updatedAtFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short"
});

function formatUpdatedAt(updatedAt: string) {
  return updatedAtFormatter.format(new Date(updatedAt));
}

function formatUsageLabel(tag: TagItem) {
  if (tag.isInUse) {
    return `使用中 (${tag.usedProductCount}件)`;
  }

  return "未使用";
}

export function TagManagementPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<TagItem | null>(null);
  const tagForm = useZodForm(tagInputSchema, {
    defaultValues: defaultTagFormValues,
    mode: "onChange"
  });
  const tagsQuery = useQuery({
    queryKey: queryKeys.tags.list,
    queryFn: async () => {
      const response = await apiClient.get<TagListData>(API_PATHS.tags);

      return response.data;
    }
  });

  const refreshTags = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.tags.list
    });
  }, [queryClient]);

  const resetTagForm = useCallback(() => {
    setEditingTag(null);
    tagForm.clearErrors();
    tagForm.reset(defaultTagFormValues);
  }, [tagForm]);

  const applyFormApiErrors = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiClientError) || !error.details?.length) {
        return false;
      }

      let applied = false;

      error.details.forEach((detail) => {
        if (detail.field === "name") {
          tagForm.setError("name", {
            message: detail.message,
            type: "server"
          });
          applied = true;
        }
      });

      return applied;
    },
    [tagForm]
  );

  const createTagMutation = useMutation({
    mutationFn: async (input: TagInput) => {
      const response = await apiClient.post<
        TagMutationData,
        undefined,
        TagInput
      >(API_PATHS.tags, {
        body: input
      });

      return response.data;
    },
    onSuccess: refreshTags
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({
      input,
      tagId
    }: {
      input: TagInput;
      tagId: string;
    }) => {
      const response = await apiClient.put<
        TagMutationData,
        undefined,
        TagInput
      >(getTagPath(tagId), {
        body: input
      });

      return response.data;
    },
    onSuccess: refreshTags
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const response = await apiClient.delete<TagMutationData>(getTagPath(tagId));

      return response.data;
    },
    onSuccess: refreshTags
  });

  const isPageBusy =
    tagsQuery.isFetching ||
    createTagMutation.isPending ||
    updateTagMutation.isPending ||
    deleteTagMutation.isPending;

  const handleEditStart = (tag: TagItem) => {
    setNotice(null);
    setEditingTag(tag);
    tagForm.clearErrors();
    tagForm.reset({
      name: tag.name
    });
  };

  const handleTagSubmit = tagForm.handleSubmit(async (values) => {
    setNotice(null);
    tagForm.clearErrors();

    if (!editingTag) {
      try {
        await createTagMutation.mutateAsync(values);
        resetTagForm();
        setNotice({
          message: "タグを登録しました。",
          type: "success"
        });
      } catch (error) {
        const hasFieldError = applyFormApiErrors(error);

        if (!hasFieldError) {
          setNotice({
            message: getApiErrorDisplayMessage(error, {
              fallbackMessage: "タグを登録できませんでした。"
            }),
            type: "error"
          });
        }
      }

      return;
    }

    try {
      await updateTagMutation.mutateAsync({
        input: values,
        tagId: editingTag.tagId
      });
      resetTagForm();
      setNotice({
        message: "タグを更新しました。",
        type: "success"
      });
    } catch (error) {
      const hasFieldError = applyFormApiErrors(error);

      if (error instanceof ApiClientError && error.code === "TAG_NOT_FOUND") {
        resetTagForm();
        await refreshTags();
      }

      if (!hasFieldError) {
        setNotice({
          message: getApiErrorDisplayMessage(error, {
            fallbackMessage: "タグを更新できませんでした。"
          }),
          type: "error"
        });
      }
    }
  });

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteTag) {
      return;
    }

    const tagToDelete = pendingDeleteTag;

    setNotice(null);

    try {
      await deleteTagMutation.mutateAsync(tagToDelete.tagId);
      setPendingDeleteTag(null);

      if (editingTag?.tagId === tagToDelete.tagId) {
        resetTagForm();
      }

      setNotice({
        message: "タグを削除しました。",
        type: "success"
      });
    } catch (error) {
      setPendingDeleteTag(null);

      if (error instanceof ApiClientError && error.code === "TAG_NOT_FOUND") {
        if (editingTag?.tagId === tagToDelete.tagId) {
          resetTagForm();
        }

        await refreshTags();
      }

      setNotice({
        message: getApiErrorDisplayMessage(error, {
          fallbackMessage: "タグを削除できませんでした。"
        }),
        type: "error"
      });
    }
  };

  if (tagsQuery.isPending) {
    return (
      <section className="management-page" aria-labelledby="tags-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">Handmade Item Management</p>
          <h1 id="tags-title">タグ管理</h1>
          <p className="management-page__lead">
            一覧の確認と、新規登録、更新、未使用タグの削除をまとめて進めます。
          </p>
        </div>
        <ScreenLoadingState message="タグ一覧を読み込んでいます..." />
      </section>
    );
  }

  if (tagsQuery.isError) {
    return (
      <section className="management-page" aria-labelledby="tags-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">Handmade Item Management</p>
          <h1 id="tags-title">タグ管理</h1>
          <p className="management-page__lead">
            一覧の確認と、新規登録、更新、未使用タグの削除をまとめて進めます。
          </p>
        </div>
        <ScreenErrorState
          message="タグ一覧を取得できませんでした。"
          onRetry={() => {
            void tagsQuery.refetch();
          }}
        />
      </section>
    );
  }

  const tags = tagsQuery.data.items;

  return (
    <section className="management-page" aria-labelledby="tags-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">Handmade Item Management</p>
        <h1 id="tags-title">タグ管理</h1>
        <p className="management-page__lead">
          一覧の確認と、新規登録、更新、未使用タグの削除をまとめて進めます。
        </p>
        {tagsQuery.isFetching ? (
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

      <section className="management-page__section" aria-labelledby="tag-form-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="tag-form-title" className="management-page__section-title">
              {editingTag ? "タグ更新" : "タグ登録"}
            </h2>
            <p className="management-page__section-summary">
              タグ名は必須です。商品に紐づく前提で分かりやすい名前に揃えます。
            </p>
          </div>
        </div>
        <form className="management-form" noValidate onSubmit={handleTagSubmit}>
          <div className="management-form__grid is-single-column">
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="tag-name">
                タグ名
              </label>
              <input
                {...tagForm.register("name")}
                id="tag-name"
                className="auth-field__input"
                disabled={isPageBusy}
                type="text"
              />
              {tagForm.formState.errors.name ? (
                <p className="auth-field__error" role="alert">
                  {tagForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="management-form__actions">
            <button
              className="primary-button"
              disabled={!tagForm.formState.isValid || isPageBusy}
              type="submit"
            >
              {editingTag ? "更新する" : "登録する"}
            </button>
            {editingTag ? (
              <button
                className="secondary-button"
                disabled={isPageBusy}
                type="button"
                onClick={resetTagForm}
              >
                キャンセル
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="management-page__section" aria-labelledby="tag-list-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="tag-list-title" className="management-page__section-title">
              タグ一覧
            </h2>
            <p className="management-page__section-summary">
              更新日時と使用状態を確認しながら、編集と削除を切り替えます。
            </p>
          </div>
        </div>
        {tags.length === 0 ? (
          <ScreenEmptyState message="タグはまだ登録されていません。最初のタグを登録してください。" />
        ) : (
          <div className="management-list" role="list">
            {tags.map((tag) => (
              <article
                key={tag.tagId}
                aria-labelledby={`tag-name-${tag.tagId}`}
                className="management-card"
                role="listitem"
              >
                <div className="management-card__header">
                  <div>
                    <h3 id={`tag-name-${tag.tagId}`} className="management-card__title">
                      {tag.name}
                    </h3>
                    <p className="management-card__subtitle">
                      更新日時: {formatUpdatedAt(tag.updatedAt)}
                    </p>
                  </div>
                  <span
                    className={
                      tag.isInUse
                        ? "management-badge is-in-use"
                        : "management-badge is-idle"
                    }
                  >
                    {formatUsageLabel(tag)}
                  </span>
                </div>
                <dl className="management-card__details is-single-column">
                  <div>
                    <dt>参照件数</dt>
                    <dd>{tag.usedProductCount}件</dd>
                  </div>
                </dl>
                <div className="management-card__actions">
                  <button
                    className="secondary-button"
                    disabled={isPageBusy}
                    type="button"
                    onClick={() => handleEditStart(tag)}
                  >
                    編集する
                  </button>
                  <button
                    className="danger-button"
                    disabled={isPageBusy || tag.isInUse}
                    type="button"
                    onClick={() => setPendingDeleteTag(tag)}
                  >
                    削除する
                  </button>
                </div>
                {tag.isInUse ? (
                  <p className="management-card__note">
                    使用中のため削除できません。
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {pendingDeleteTag ? (
        <div className="app-dialog__backdrop" role="presentation">
          <section
            aria-labelledby="tag-delete-title"
            aria-modal="true"
            className="app-dialog"
            role="dialog"
          >
            <h2 id="tag-delete-title">タグ削除確認</h2>
            <p className="app-dialog__summary">
              「{pendingDeleteTag.name}」を削除しますか？
              このタグを参照している商品がない場合のみ削除できます。
            </p>
            <div className="app-dialog__actions">
              <button
                className="secondary-button"
                disabled={deleteTagMutation.isPending}
                type="button"
                onClick={() => setPendingDeleteTag(null)}
              >
                キャンセル
              </button>
              <button
                className="danger-button"
                disabled={deleteTagMutation.isPending}
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
