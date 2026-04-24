import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { registerAuthRoutes } from "./auth";
import { registerCategoryRoutes } from "./categories";
import { registerCustomerRoutes } from "./customers";
import { registerDashboardRoutes } from "./dashboard";
import { registerProductRoutes } from "./products";
import { registerTagRoutes } from "./tags";

export function registerDefaultProtectedRoutes(
  router: Router,
  context: CreateProtectedAppContext
) {
  registerAuthRoutes(router, context);
  registerCategoryRoutes(router, context);
  registerCustomerRoutes(router, context);
  registerDashboardRoutes(router, context);
  registerProductRoutes(router, context);
  registerTagRoutes(router, context);
}
