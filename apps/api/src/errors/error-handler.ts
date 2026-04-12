import type { NextFunction, Request, Response } from "express";
import type { ApiLogger } from "../middlewares/request-logger";
import { AppError } from "./app-error";
import { createInternalError, toApiErrorResponse } from "./api-errors";

const INTERNAL_ERROR_RESPONSE = toApiErrorResponse(createInternalError());

export function createErrorHandler(
  logger: Pick<ApiLogger, "error"> = console
) {
  return function errorHandler(
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction
  ) {
    void next;

    if (error instanceof AppError) {
      response.status(error.statusCode).json(toApiErrorResponse(error));
      return;
    }

    logger.error("Unhandled API error", error);
    response.status(500).json(INTERNAL_ERROR_RESPONSE);
  };
}

export const errorHandler = createErrorHandler();
