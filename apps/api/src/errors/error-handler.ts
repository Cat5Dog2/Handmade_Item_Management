import type { ApiErrorResponse } from "@handmade/shared";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "./app-error";

const INTERNAL_ERROR_RESPONSE: ApiErrorResponse = {
  code: "INTERNAL_ERROR",
  message: "システムエラーが発生しました。"
};

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction
) {
  void next;

  if (error instanceof AppError) {
    const payload: ApiErrorResponse = {
      code: error.code,
      message: error.message
    };

    if (error.details && error.details.length > 0) {
      payload.details = error.details;
    }

    response.status(error.statusCode).json(payload);
    return;
  }

  console.error("Unhandled API error", error);
  response.status(500).json(INTERNAL_ERROR_RESPONSE);
}
