import "./env";
import cors from "cors";
import express, { type RequestHandler, type Router } from "express";
import { createErrorHandler } from "./errors/error-handler";
import { requireAuth } from "./middlewares/auth";
import {
  createRequestLogger,
  type ApiLogger
} from "./middlewares/request-logger";

const DEFAULT_API_BASE_PATH = "/api";
const DEFAULT_SERVICE_NAME = "handmade-sales-api";

interface CreateAppContext {
  apiBasePath: string;
}

interface CreateProtectedAppContext extends CreateAppContext {
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
  const requireAuthMiddleware =
    options.requireAuthMiddleware ?? requireAuth;
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
    response.status(200).json({
      data: {
        status: "ok",
        service: DEFAULT_SERVICE_NAME
      }
    });
  });

  options.registerPublicRoutes?.(publicApiRouter, {
    apiBasePath
  });

  options.registerProtectedRoutes?.(protectedApiRouter, {
    apiBasePath,
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
