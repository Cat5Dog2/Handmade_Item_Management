import type { RequestHandler } from "express";

export interface ApiLogger {
  info: (message?: unknown, ...optionalParams: unknown[]) => void;
  error: (message?: unknown, ...optionalParams: unknown[]) => void;
}

export function createRequestLogger(logger: ApiLogger): RequestHandler {
  return (request, response, next) => {
    const startedAt = Date.now();

    response.once("finish", () => {
      logger.info("API request completed", {
        method: request.method,
        requestPath: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        actorUid: request.authContext?.actorUid ?? null
      });
    });

    next();
  };
}
