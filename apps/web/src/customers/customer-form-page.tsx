import type {
  CustomerCreateData,
  CustomerCreateInput,
  CustomerDetailData,
  CustomerSnsAccount,
  CustomerUpdateData,
  CustomerUpdateInput
} from "@handmade/shared";
import {
  API_PATHS,
  getCustomerPath,
  customerCreateInputSchema,
  customerUpdateInputSchema
} from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { z } from "zod";
import { ApiClientError } from "../api/api-client";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import {
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import { useZodForm } from "../forms/use-zod-form";

interface PageNotice {
  message: string;
  type: "error" | "success";
}

type CustomerFormInput = z.input<typeof customerCreateInputSchema>;

type CustomerFormFieldName =
  | "ageGroup"
  | "customerStyle"
  | "gender"
  | "memo"
  | "name"
  | "snsAccounts";

const APP_NAME = "Handmade Item Management";

const emptyCustomerFormValues: CustomerFormInput = {
  ageGroup: "",
  customerStyle: "",
  gender: "",
  memo: "",
  name: "",
  snsAccounts: []
};

const emptySnsAccount: CustomerSnsAccount = {
  accountName: "",
  note: "",
  platform: "",
  url: ""
};

const genderOptions = ["女性", "男性", "その他"] as const;
const ageGroupOptions = ["10代", "20代", "30代", "40代", "50代", "60代以上"] as const;

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiClientError) {
    if (error.code === "CUSTOMER_NOT_FOUND") {
      return "対象の顧客が見つかりません。";
    }

    if (error.code === "CUSTOMER_ARCHIVED") {
      return "アーカイブ済みの顧客は編集できません。詳細画面で内容をご確認ください。";
    }

    return error.message;
  }

  return fallbackMessage;
}

function toFormText(value: string | null | undefined) {
  return value ?? "";
}

function toCustomerFormValues(data: CustomerDetailData): CustomerFormInput {
  const customer = data.customer;

  return {
    ageGroup: toFormText(customer.ageGroup),
    customerStyle: toFormText(customer.customerStyle),
    gender: toFormText(customer.gender),
    memo: toFormText(customer.memo),
    name: customer.name,
    snsAccounts: customer.snsAccounts.map((account) => ({
      accountName: toFormText(account.accountName),
      note: toFormText(account.note),
      platform: toFormText(account.platform),
      url: toFormText(account.url)
    }))
  };
}

function getFieldErrorMessage(
  fieldName: CustomerFormFieldName,
  fallbackMessage?: string
) {
  if (fieldName === "name") {
    return fallbackMessage?.includes("100")
      ? "顧客名は100文字以内で入力してください。"
      : "顧客名を入力してください。";
  }

  if (fieldName === "customerStyle") {
    return "系統メモは100文字以内で入力してください。";
  }

  if (fieldName === "memo") {
    return "顧客メモは1000文字以内で入力してください。";
  }

  if (fieldName === "snsAccounts") {
    return "SNSアカウントの入力内容を確認してください。";
  }

  return fallbackMessage ?? "入力内容を確認してください。";
}

function buildNotice(message: string): PageNotice {
  return {
    message,
    type: "success"
  };
}

export function CustomerFormPage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { customerId } = useParams();
  const isEditMode = Boolean(customerId);
  const [notice, setNotice] = useState<PageNotice | null>(null);

  const formSchema = useMemo(
    () => (isEditMode ? customerUpdateInputSchema : customerCreateInputSchema),
    [isEditMode]
  );
  const customerForm = useZodForm(formSchema, {
    defaultValues: emptyCustomerFormValues,
    mode: "onChange"
  });
  const snsAccountsFieldArray = useFieldArray({
    control: customerForm.control,
    name: "snsAccounts"
  });

  const customerDetailQuery = useQuery({
    enabled: isEditMode && Boolean(customerId),
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

  useEffect(() => {
    if (!customerDetailQuery.data) {
      return;
    }

    customerForm.reset(toCustomerFormValues(customerDetailQuery.data));
  }, [customerDetailQuery.data, customerForm]);

  const refreshCustomerQueries = useCallback(
    async (nextCustomerId: string) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customers", "list"]
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.detail(nextCustomerId)
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.purchases(nextCustomerId)
        })
      ]);
    },
    [queryClient]
  );

  const createCustomerMutation = useMutation({
    mutationFn: async (input: CustomerCreateInput) => {
      const response = await apiClient.post<
        CustomerCreateData,
        undefined,
        CustomerCreateInput
      >(API_PATHS.customers, {
        body: input
      });

      return response.data;
    },
    onSuccess: async (data) => {
      await refreshCustomerQueries(data.customerId);
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (input: CustomerUpdateInput) => {
      const response = await apiClient.put<
        CustomerUpdateData,
        undefined,
        CustomerUpdateInput
      >(getCustomerPath(customerId ?? ""), {
        body: input
      });

      return response.data;
    },
    onSuccess: async (data) => {
      await refreshCustomerQueries(data.customerId);
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
          detail.field === "gender" ||
          detail.field === "ageGroup" ||
          detail.field === "customerStyle" ||
          detail.field === "snsAccounts" ||
          detail.field === "memo"
        ) {
          customerForm.setError(detail.field as CustomerFormFieldName, {
            message: getFieldErrorMessage(
              detail.field as CustomerFormFieldName,
              detail.message
            ),
            type: "server"
          });
          applied = true;
        }
      });

      return applied;
    },
    [customerForm]
  );

  const handleCancel = () => {
    navigate(isEditMode && customerId ? `/customers/${customerId}` : "/customers");
  };

  const handleCustomerSubmit = customerForm.handleSubmit(async (values) => {
    setNotice(null);
    customerForm.clearErrors();

    if (!isEditMode) {
      try {
        const result = await createCustomerMutation.mutateAsync(values);
        navigate(`/customers/${result.customerId}`, {
          replace: true,
          state: {
            notice: buildNotice("顧客を登録しました。")
          }
        });
      } catch (error) {
        const hasFieldError = applyFormApiErrors(error);

        if (!hasFieldError) {
          setNotice({
            message: getErrorMessage(error, "顧客を登録できませんでした。"),
            type: "error"
          });
        }
      }

      return;
    }

    if (!customerId) {
      setNotice({
        message: "対象の顧客が見つかりません。",
        type: "error"
      });
      return;
    }

    try {
      const result = await updateCustomerMutation.mutateAsync(values);
      navigate(`/customers/${result.customerId}`, {
        replace: true,
        state: {
          notice: buildNotice("顧客情報を更新しました。")
        }
      });
    } catch (error) {
      const hasFieldError = applyFormApiErrors(error);

      if (error instanceof ApiClientError && error.code === "CUSTOMER_ARCHIVED") {
        await refreshCustomerQueries(customerId);
      }

      if (!hasFieldError) {
        setNotice({
          message: getErrorMessage(error, "顧客情報を更新できませんでした。"),
          type: "error"
        });
      }
    }
  });

  const pageTitle = isEditMode ? "顧客編集" : "顧客登録";
  const isInitialLoading = isEditMode && customerDetailQuery.isPending;
  const loadError = customerDetailQuery.error;
  const customer = customerDetailQuery.data?.customer;
  const isArchivedCustomer = Boolean(customer?.isArchived);
  const isPageBusy =
    customerDetailQuery.isFetching ||
    createCustomerMutation.isPending ||
    updateCustomerMutation.isPending ||
    isArchivedCustomer;
  const formErrors = customerForm.formState.errors;
  const snsAccountsErrorMessage =
    formErrors.snsAccounts && !Array.isArray(formErrors.snsAccounts)
      ? getFieldErrorMessage("snsAccounts", formErrors.snsAccounts.message)
      : null;

  if (isInitialLoading) {
    return (
      <section className="management-page customer-form-page" aria-labelledby="customer-form-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="customer-form-title">{pageTitle}</h1>
          <p className="management-page__lead">
            顧客情報を登録・更新します。
          </p>
        </div>
        <ScreenLoadingState message="顧客情報を読み込んでいます..." />
      </section>
    );
  }

  if (isEditMode && (loadError || !customerDetailQuery.data)) {
    return (
      <section className="management-page customer-form-page" aria-labelledby="customer-form-title">
        <div className="management-page__header">
          <p className="management-page__eyebrow">{APP_NAME}</p>
          <h1 id="customer-form-title">{pageTitle}</h1>
          <p className="management-page__lead">
            顧客情報を登録・更新します。
          </p>
        </div>
        <ScreenErrorState
          message={getErrorMessage(loadError, "顧客情報を取得できませんでした。")}
          onRetry={() => {
            void customerDetailQuery.refetch();
          }}
        />
      </section>
    );
  }

  return (
    <section className="management-page customer-form-page" aria-labelledby="customer-form-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <h1 id="customer-form-title">{pageTitle}</h1>
        <p className="management-page__lead">
          顧客名、属性、SNSアカウント、メモを保存します。
        </p>
        {customerDetailQuery.isFetching ? (
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
        {isArchivedCustomer ? (
          <div className="management-page__notice is-error" role="alert">
            <p>
              アーカイブ済みの顧客は編集できません。詳細画面で内容をご確認ください。
            </p>
            <Link
              className="secondary-button button-link"
              to={`/customers/${customer?.customerId}`}
            >
              詳細へ戻る
            </Link>
          </div>
        ) : null}
      </div>

      <section className="management-page__section" aria-labelledby="customer-form-section-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="customer-form-section-title" className="management-page__section-title">
              基本情報
            </h2>
            <p className="management-page__section-summary">
              顧客名は必須です。電話番号とメールアドレスはMVPでは扱いません。
            </p>
          </div>
        </div>

        <form className="management-form customer-form" noValidate onSubmit={handleCustomerSubmit}>
          <div className="management-form__grid">
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="customer-name">
                顧客名
              </label>
              <input
                {...customerForm.register("name")}
                id="customer-name"
                className="auth-field__input"
                aria-invalid={Boolean(formErrors.name)}
                disabled={isPageBusy}
                type="text"
              />
              {formErrors.name ? (
                <p className="auth-field__error" role="alert">
                  {getFieldErrorMessage("name", formErrors.name.message)}
                </p>
              ) : null}
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="customer-gender">
                性別
              </label>
              <input
                {...customerForm.register("gender")}
                id="customer-gender"
                className="auth-field__input"
                disabled={isPageBusy}
                list="customer-gender-options"
                type="text"
              />
              <datalist id="customer-gender-options">
                {genderOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="customer-age-group">
                年代
              </label>
              <input
                {...customerForm.register("ageGroup")}
                id="customer-age-group"
                className="auth-field__input"
                disabled={isPageBusy}
                list="customer-age-group-options"
                type="text"
              />
              <datalist id="customer-age-group-options">
                {ageGroupOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="customer-style">
                系統メモ
              </label>
              <input
                {...customerForm.register("customerStyle")}
                id="customer-style"
                className="auth-field__input"
                aria-invalid={Boolean(formErrors.customerStyle)}
                disabled={isPageBusy}
                type="text"
              />
              {formErrors.customerStyle ? (
                <p className="auth-field__error" role="alert">
                  {getFieldErrorMessage(
                    "customerStyle",
                    formErrors.customerStyle.message
                  )}
                </p>
              ) : null}
            </div>

            <div className="auth-field customer-form__memo">
              <label className="auth-field__label" htmlFor="customer-memo">
                顧客メモ
              </label>
              <textarea
                {...customerForm.register("memo")}
                id="customer-memo"
                className="auth-field__input customer-form__textarea"
                aria-invalid={Boolean(formErrors.memo)}
                disabled={isPageBusy}
                rows={5}
              />
              {formErrors.memo ? (
                <p className="auth-field__error" role="alert">
                  {getFieldErrorMessage("memo", formErrors.memo.message)}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset className="customer-form__sns-group">
            <div className="customer-form__sns-header">
              <legend className="auth-field__label">SNSアカウント</legend>
              <button
                className="secondary-button"
                disabled={isPageBusy}
                type="button"
                onClick={() => snsAccountsFieldArray.append(emptySnsAccount)}
              >
                SNSを追加
              </button>
            </div>
            {snsAccountsErrorMessage ? (
              <p className="auth-field__error" role="alert">
                {snsAccountsErrorMessage}
              </p>
            ) : null}
            {snsAccountsFieldArray.fields.length === 0 ? (
              <p className="management-form__hint">SNSアカウントは任意です。</p>
            ) : (
              <div className="customer-form__sns-list">
                {snsAccountsFieldArray.fields.map((field, index) => (
                  <article key={field.id} className="management-card customer-form__sns-card">
                    <div className="management-card__header">
                      <h3 className="management-card__title">
                        SNSアカウント {index + 1}
                      </h3>
                      <button
                        className="secondary-button"
                        disabled={isPageBusy}
                        type="button"
                        onClick={() => snsAccountsFieldArray.remove(index)}
                      >
                        削除
                      </button>
                    </div>
                    <div className="management-form__grid">
                      <div className="auth-field">
                        <label
                          className="auth-field__label"
                          htmlFor={`customer-sns-platform-${field.id}`}
                        >
                          プラットフォーム
                        </label>
                        <input
                          {...customerForm.register(`snsAccounts.${index}.platform`)}
                          id={`customer-sns-platform-${field.id}`}
                          className="auth-field__input"
                          disabled={isPageBusy}
                          type="text"
                        />
                      </div>
                      <div className="auth-field">
                        <label
                          className="auth-field__label"
                          htmlFor={`customer-sns-account-${field.id}`}
                        >
                          アカウント名
                        </label>
                        <input
                          {...customerForm.register(`snsAccounts.${index}.accountName`)}
                          id={`customer-sns-account-${field.id}`}
                          className="auth-field__input"
                          disabled={isPageBusy}
                          type="text"
                        />
                      </div>
                      <div className="auth-field customer-form__sns-url">
                        <label
                          className="auth-field__label"
                          htmlFor={`customer-sns-url-${field.id}`}
                        >
                          URL
                        </label>
                        <input
                          {...customerForm.register(`snsAccounts.${index}.url`)}
                          id={`customer-sns-url-${field.id}`}
                          className="auth-field__input"
                          disabled={isPageBusy}
                          type="url"
                        />
                      </div>
                      <div className="auth-field customer-form__sns-note">
                        <label
                          className="auth-field__label"
                          htmlFor={`customer-sns-note-${field.id}`}
                        >
                          補足
                        </label>
                        <textarea
                          {...customerForm.register(`snsAccounts.${index}.note`)}
                          id={`customer-sns-note-${field.id}`}
                          className="auth-field__input customer-form__textarea"
                          disabled={isPageBusy}
                          rows={3}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </fieldset>

          <div className="management-form__actions">
            <button
              className="primary-button"
              disabled={!customerForm.formState.isValid || isPageBusy}
              type="submit"
            >
              {isEditMode
                ? updateCustomerMutation.isPending
                  ? "更新中..."
                  : "更新する"
                : createCustomerMutation.isPending
                  ? "登録中..."
                  : "登録する"}
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
    </section>
  );
}
