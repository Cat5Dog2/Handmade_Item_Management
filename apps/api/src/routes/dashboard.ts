import type { DashboardResponseData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { getDashboard } from "../dashboard/get-dashboard";
import { sendSuccess } from "../responses/api-response";

interface RegisterDashboardRoutesOptions {
  getDashboardHandler?: () => Promise<DashboardResponseData>;
}

export function registerDashboardRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterDashboardRoutesOptions = {}
) {
  const getDashboardHandler = options.getDashboardHandler ?? getDashboard;

  router.get(
    "/dashboard",
    context.requireAuthMiddleware,
    async (_request, response, next) => {
      try {
        sendSuccess(response, await getDashboardHandler());
      } catch (error) {
        next(error);
      }
    }
  );
}
