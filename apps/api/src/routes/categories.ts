import type { CategoryListData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { sendSuccess } from "../responses/api-response";
import { listCategories } from "../categories/list-categories";

interface RegisterCategoryRoutesOptions {
  listCategoriesHandler?: () => Promise<CategoryListData>;
}

export function registerCategoryRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterCategoryRoutesOptions = {}
) {
  const listCategoriesHandler = options.listCategoriesHandler ?? listCategories;

  router.get("/categories", context.requireAuthMiddleware, async (_request, response, next) => {
    try {
      sendSuccess(response, await listCategoriesHandler());
    } catch (error) {
      next(error);
    }
  });
}
