import type { ApiErrorCode } from "@handmade/shared";
import { ApiClientError } from "./api-client";
import { API_ERROR_CODE_MESSAGES } from "./error-code-messages";

export interface ApiErrorDisplayOptions {
  codeMessages?: Partial<Record<ApiErrorCode, string>>;
  fallbackMessage: string;
  fallbackMessageCodes?: ApiErrorCode[];
}

export function getApiErrorDisplayMessage(
  error: unknown,
  {
    codeMessages = {},
    fallbackMessage,
    fallbackMessageCodes = []
  }: ApiErrorDisplayOptions
) {
  if (!(error instanceof ApiClientError)) {
    return fallbackMessage;
  }

  if (fallbackMessageCodes.includes(error.code)) {
    return fallbackMessage;
  }

  return (
    codeMessages[error.code] ??
    API_ERROR_CODE_MESSAGES[error.code] ??
    fallbackMessage
  );
}
