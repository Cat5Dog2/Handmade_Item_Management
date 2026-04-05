import "./env";
import cors from "cors";
import express from "express";
import { errorHandler } from "./errors/error-handler";

const DEFAULT_API_BASE_PATH = "/api";
const DEFAULT_SERVICE_NAME = "handmade-sales-api";

export function createApp() {
  const app = express();
  const apiBasePath = process.env.API_BASE_PATH ?? DEFAULT_API_BASE_PATH;
  const corsOrigin = process.env.CORS_ORIGIN;

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

  app.use(errorHandler);

  return app;
}
