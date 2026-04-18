import type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiSuccessResponse
} from "@handmade/shared";
import { apiErrorResponseSchema } from "@handmade/shared";
import {
  AUTH_FORBIDDEN_MESSAGE,
  SESSION_EXPIRED_MESSAGE
} from "../auth/auth-session";

const DEFAULT_INTERNAL_ERROR_MESSAGE =
  "予期しないエラーが発生しました。時間をおいて再度お試しください。";

type FetchRequestInit = NonNullable<Parameters<typeof fetch>[1]>;
type FetchBody = NonNullable<FetchRequestInit["body"]>;
type FetchHeaders = NonNullable<FetchRequestInit["headers"]>;
type ApiRequestQueryValue = boolean | number | string | null | undefined;

export interface ApiRequestOptions<TBody = unknown> {
  body?: FetchBody | TBody;
  headers?: FetchHeaders;
  query?: Record<string, ApiRequestQueryValue>;
  requireAuth?: boolean;
  signal?: AbortSignal;
}

export interface CreateApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getIdToken?: () => Promise<string | null>;
  onForbidden?: () => void;
  onUnauthorized?: () => void;
}

interface ParsedApiError {
  code: ApiErrorCode;
  details?: ApiErrorDetail[];
  message: string;
}

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorDetail[];
  readonly status: number;

  constructor(status: number, options: ParsedApiError) {
    super(options.message);
    this.name = "ApiClientError";
    this.code = options.code;
    this.details = options.details;
    this.status = status;
  }
}

function getFallbackError(status: number): ParsedApiError {
  if (status === 401) {
    return {
      code: "AUTH_REQUIRED",
      message: SESSION_EXPIRED_MESSAGE
    };
  }

  if (status === 403) {
    return {
      code: "AUTH_FORBIDDEN",
      message: AUTH_FORBIDDEN_MESSAGE
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: DEFAULT_INTERNAL_ERROR_MESSAGE
  };
}

function isBodyInit(value: unknown): value is FetchBody {
  return (
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    typeof value === "string"
  );
}

function buildRequestUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, ApiRequestQueryValue>
) {
  const requestPath = /^https?:\/\//.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const origin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(requestPath, origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function parseApiError(response: Response) {
  const fallbackError = getFallbackError(response.status);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return fallbackError;
  }

  try {
    const payload = await response.json();
    const parsed = apiErrorResponseSchema.safeParse(payload);

    if (!parsed.success) {
      return fallbackError;
    }

    return parsed.data;
  } catch {
    return fallbackError;
  }
}

export function createApiClient(options: CreateApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? "/api";
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<TData, TMeta = undefined, TBody = unknown>(
    method: string,
    path: string,
    requestOptions: ApiRequestOptions<TBody> = {}
  ) {
    const headers = new Headers(requestOptions.headers);
    const shouldAttachAuth = requestOptions.requireAuth ?? true;

    if (shouldAttachAuth) {
      const idToken = await options.getIdToken?.();

      if (idToken) {
        headers.set("Authorization", `Bearer ${idToken}`);
      }
    }

    let body: FetchBody | undefined;

    if (requestOptions.body !== undefined) {
      if (isBodyInit(requestOptions.body)) {
        body = requestOptions.body;
      } else {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(requestOptions.body);
      }
    }

    const response = await fetchImpl(
      buildRequestUrl(baseUrl, path, requestOptions.query),
      {
        method,
        headers,
        body,
        signal: requestOptions.signal
      }
    );

    if (!response.ok) {
      const parsedError = await parseApiError(response);

      if (response.status === 401) {
        options.onUnauthorized?.();
      }

      if (response.status === 403) {
        options.onForbidden?.();
      }

      throw new ApiClientError(response.status, parsedError);
    }

    return (await response.json()) as ApiSuccessResponse<TData, TMeta>;
  }

  return {
    delete: <TData, TMeta = undefined>(
      path: string,
      requestOptions?: ApiRequestOptions
    ) => request<TData, TMeta>("DELETE", path, requestOptions),
    get: <TData, TMeta = undefined>(
      path: string,
      requestOptions?: ApiRequestOptions
    ) => request<TData, TMeta>("GET", path, requestOptions),
    patch: <TData, TMeta = undefined, TBody = unknown>(
      path: string,
      requestOptions?: ApiRequestOptions<TBody>
    ) => request<TData, TMeta, TBody>("PATCH", path, requestOptions),
    post: <TData, TMeta = undefined, TBody = unknown>(
      path: string,
      requestOptions?: ApiRequestOptions<TBody>
    ) => request<TData, TMeta, TBody>("POST", path, requestOptions),
    put: <TData, TMeta = undefined, TBody = unknown>(
      path: string,
      requestOptions?: ApiRequestOptions<TBody>
    ) => request<TData, TMeta, TBody>("PUT", path, requestOptions),
    request
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
