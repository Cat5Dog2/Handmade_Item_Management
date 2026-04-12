import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { registerCategoryRoutes } from "./categories";

export function registerDefaultProtectedRoutes(
  router: Router,
  context: CreateProtectedAppContext
) {
  registerCategoryRoutes(router, context);
}
