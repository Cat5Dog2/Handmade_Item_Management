import type { NextFunction, Request, Response } from "express";
import type { ApiLogger } from "../middlewares/request-logger";
import { AppError } from "./app-error";
import { createInternalError, toApiErrorResponse } from "./api-errors";
import { writeOperationLog } from "../operation-logs/write-operation-log";

const INTERNAL_ERROR_RESPONSE = toApiErrorResponse(createInternalError());
const ERROR_OPERATION_LOG_SUMMARY = "API内部エラーが発生しました";

function shouldWriteErrorOperationLog(error: unknown) {
  return !(error instanceof AppError) || error.statusCode >= 500;
}

function getErrorOperationLogDetail(request: Request, error: unknown) {
  return {
    requestPath: request.originalUrl,
    method: request.method,
    errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
    statusCode: error instanceof AppError ? error.statusCode : 500
  };
}

async function writeErrorOperationLog(
  error: unknown,
  request: Request
) {
  if (!shouldWriteErrorOperationLog(error)) {
    return;
  }

  await writeOperationLog({
    eventType: "ERROR",
    targetId: null,
    summary: ERROR_OPERATION_LOG_SUMMARY,
    actorUid: request.authContext?.actorUid ?? null,
    detail: getErrorOperationLogDetail(request, error)
  });
}

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
      if (error.statusCode >= 500) {
        logger.error("API major error", error);
      }

      void writeErrorOperationLog(error, _request).catch((logError) => {
        logger.error("Failed to write error operation log", logError);
      });
      response.status(error.statusCode).json(toApiErrorResponse(error));
      return;
    }

    void writeErrorOperationLog(error, _request).catch((logError) => {
      logger.error("Failed to write error operation log", logError);
    });
    logger.error("Unhandled API error", error);
    response.status(500).json(INTERNAL_ERROR_RESPONSE);
  };
}

export const errorHandler = createErrorHandler();
