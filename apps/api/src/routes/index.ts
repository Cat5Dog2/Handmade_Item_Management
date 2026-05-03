import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { registerAuthRoutes } from "./auth";
import { registerCategoryRoutes } from "./categories";
import { registerCustomerRoutes } from "./customers";
import { registerDashboardRoutes } from "./dashboard";
import { registerProductRoutes } from "./products";
import { registerQrRoutes } from "./qr";
import { registerTagRoutes } from "./tags";
import { registerTaskRoutes } from "./tasks";

export function registerDefaultProtectedRoutes(
  router: Router,
  context: CreateProtectedAppContext
) {
  registerAuthRoutes(router, context);
  registerCategoryRoutes(router, context);
  registerCustomerRoutes(router, context);
  registerDashboardRoutes(router, context);
  registerProductRoutes(router, context);
  registerQrRoutes(router, context);
  registerTagRoutes(router, context);
  registerTaskRoutes(router, context);
}
