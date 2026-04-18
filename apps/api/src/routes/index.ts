import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { registerAuthRoutes } from "./auth";
import { registerCategoryRoutes } from "./categories";
import { registerProductRoutes } from "./products";
import { registerTagRoutes } from "./tags";

export function registerDefaultProtectedRoutes(
  router: Router,
  context: CreateProtectedAppContext
) {
  registerAuthRoutes(router, context);
  registerCategoryRoutes(router, context);
  registerProductRoutes(router, context);
  registerTagRoutes(router, context);
}
