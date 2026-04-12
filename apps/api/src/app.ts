import "./env";
import cors from "cors";
import express, { type Express } from "express";
import { createErrorHandler } from "./errors/error-handler";
import {
  createRequestLogger,
  type ApiLogger
} from "./middlewares/request-logger";

const DEFAULT_API_BASE_PATH = "/api";
const DEFAULT_SERVICE_NAME = "handmade-sales-api";

interface CreateAppContext {
  apiBasePath: string;
}

interface CreateAppOptions {
  logger?: ApiLogger;
  registerRoutes?: (app: Express, context: CreateAppContext) => void;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const apiBasePath = process.env.API_BASE_PATH ?? DEFAULT_API_BASE_PATH;
  const corsOrigin = process.env.CORS_ORIGIN;
  const logger = options.logger ?? console;

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

  app.get(`${apiBasePath}/health`, (_request, response) => {
    response.status(200).json({
      data: {
        status: "ok",
        service: DEFAULT_SERVICE_NAME
      }
    });
  });

  options.registerRoutes?.(app, {
    apiBasePath
  });

  app.use((_request, response) => {
    response.status(404).json({
      message: "Not Found"
    });
  });

  app.use(createErrorHandler(logger));

  return app;
}
