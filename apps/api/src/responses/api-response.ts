import type { ApiSuccessResponse } from "@handmade/shared";
import type { Response } from "express";

export function createSuccessResponse<TData, TMeta = undefined>(
  data: TData,
  meta?: TMeta
): ApiSuccessResponse<TData, TMeta> {
  const payload: ApiSuccessResponse<TData, TMeta> = {
    data
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return payload;
}

export function sendSuccess<TData, TMeta = undefined>(
  response: Response,
  data: TData,
  options: {
    meta?: TMeta;
    statusCode?: number;
  } = {}
) {
  const { meta, statusCode = 200 } = options;

  return response.status(statusCode).json(createSuccessResponse(data, meta));
}
