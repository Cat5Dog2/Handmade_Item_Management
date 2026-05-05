import "./env";
import cors from "cors";
import express, { type RequestHandler, type Router } from "express";
import { createErrorHandler } from "./errors/error-handler";
import { requireAuth } from "./middlewares/auth";
import {
  createRequestLogger,
  type ApiLogger
} from "./middlewares/request-logger";
import { sendSuccess } from "./responses/api-response";
import { registerDefaultProtectedRoutes } from "./routes";

const DEFAULT_API_BASE_PATH = "/api";
const DEFAULT_SERVICE_NAME = "handmade-sales-api";

interface CreateAppContext {
  apiBasePath: string;
  logger: ApiLogger;
}

export interface CreateProtectedAppContext extends CreateAppContext {
  requireAuthMiddleware: RequestHandler;
}

interface CreateAppOptions {
  logger?: ApiLogger;
  requireAuthMiddleware?: RequestHandler;
  registerProtectedRoutes?: (
    router: Router,
    context: CreateProtectedAppContext
  ) => void;
  registerPublicRoutes?: (router: Router, context: CreateAppContext) => void;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const apiBasePath = process.env.API_BASE_PATH ?? DEFAULT_API_BASE_PATH;
  const corsOrigin = process.env.CORS_ORIGIN;
  const logger = options.logger ?? console;
  const requireAuthMiddleware = options.requireAuthMiddleware ?? requireAuth;
  const publicApiRouter = express.Router();
  const protectedApiRouter = express.Router();

  app.use(createRequestLogger(logger));
  app.use(express.json());

  if (corsOrigin) {
    app.use(
      cors({
        origin: corsOrigin,
        credentials: true
      })
    );
  }

  publicApiRouter.get("/health", (_request, response) => {
    sendSuccess(response, {
      status: "ok" as const,
      service: DEFAULT_SERVICE_NAME
    });
  });

  options.registerPublicRoutes?.(publicApiRouter, {
    apiBasePath,
    logger
  });

  registerDefaultProtectedRoutes(protectedApiRouter, {
    apiBasePath,
    logger,
    requireAuthMiddleware
  });

  options.registerProtectedRoutes?.(protectedApiRouter, {
    apiBasePath,
    logger,
    requireAuthMiddleware
  });

  app.use(apiBasePath, publicApiRouter);
  app.use(apiBasePath, protectedApiRouter);

  app.use((_request, response) => {
    response.status(404).json({
      message: "Not Found"
    });
  });

  app.use(createErrorHandler(logger));

  return app;
}
