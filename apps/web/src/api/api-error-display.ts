import type { ApiErrorCode } from "@handmade/shared";
import { ApiClientError } from "./api-client";

interface ApiErrorDisplayOptions {
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

  return codeMessages[error.code] ?? error.message;
}
