import type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse
} from "@handmade/shared";
import { AppError } from "./app-error";

export const DEFAULT_API_ERROR_MESSAGES = {
  AUTH_REQUIRED: "セッションが切れました。再度ログインしてください。",
  AUTH_FORBIDDEN: "この操作は実行できません。",
  VALIDATION_ERROR: "入力内容を確認してください。",
  INTERNAL_ERROR: "予期しないエラーが発生しました。時間をおいて再度お試しください。"
} as const;

type SupportedDefaultErrorCode = keyof typeof DEFAULT_API_ERROR_MESSAGES;

interface CreateApiErrorOptions {
  code: ApiErrorCode;
  details?: ApiErrorDetail[];
  message?: string;
  statusCode: number;
}

export function createApiError(options: CreateApiErrorOptions) {
  const defaultMessage =
    options.code in DEFAULT_API_ERROR_MESSAGES
      ? DEFAULT_API_ERROR_MESSAGES[options.code as SupportedDefaultErrorCode]
      : undefined;

  return new AppError({
    statusCode: options.statusCode,
    code: options.code,
    message: options.message ?? defaultMessage ?? "エラーが発生しました。",
    details: options.details
  });
}

export function createValidationError(
  details?: ApiErrorDetail[],
  message = DEFAULT_API_ERROR_MESSAGES.VALIDATION_ERROR
) {
  return createApiError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message,
    details
  });
}

export function createAuthRequiredError() {
  return createApiError({
    statusCode: 401,
    code: "AUTH_REQUIRED"
  });
}

export function createAuthForbiddenError() {
  return createApiError({
    statusCode: 403,
    code: "AUTH_FORBIDDEN"
  });
}

export function createInternalError() {
  return createApiError({
    statusCode: 500,
    code: "INTERNAL_ERROR"
  });
}

export function toApiErrorResponse(
  error: Pick<AppError, "code" | "message" | "details">
): ApiErrorResponse {
  const payload: ApiErrorResponse = {
    code: error.code,
    message: error.message
  };

  if (error.details && error.details.length > 0) {
    payload.details = error.details;
  }

  return payload;
}
