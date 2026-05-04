import type { ApiErrorCode } from "@handmade/shared";
import { ApiClientError } from "./api-client";
import {
  getApiErrorDisplayMessage,
  type ApiErrorDisplayOptions
} from "./api-error-display";
import {
  normalizeApiDetails,
  type NormalizedApiDetail
} from "./normalize-api-details";

export interface UiApiError {
  code: ApiErrorCode | null;
  details: NormalizedApiDetail[];
  message: string;
  status: number | null;
}

export function mapApiErrorToUi(
  error: unknown,
  options: ApiErrorDisplayOptions
): UiApiError {
  if (error instanceof ApiClientError) {
    return {
      code: error.code,
      details: normalizeApiDetails(error.details),
      message: getApiErrorDisplayMessage(error, options),
      status: error.status
    };
  }

  return {
    code: null,
    details: [],
    message: options.fallbackMessage,
    status: null
  };
}

