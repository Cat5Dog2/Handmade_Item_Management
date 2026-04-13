import type {
  CategoryListData,
  CategoryMutationData
} from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { sendSuccess } from "../responses/api-response";
import { createCategory } from "../categories/create-category";
import { listCategories } from "../categories/list-categories";
import { updateCategory } from "../categories/update-category";

interface RegisterCategoryRoutesOptions {
  createCategoryHandler?: (input: unknown) => Promise<CategoryMutationData>;
  listCategoriesHandler?: () => Promise<CategoryListData>;
  updateCategoryHandler?: (
    categoryId: string,
    input: unknown
  ) => Promise<CategoryMutationData>;
}

export function registerCategoryRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterCategoryRoutesOptions = {}
) {
  const createCategoryHandler = options.createCategoryHandler ?? createCategory;
  const listCategoriesHandler = options.listCategoriesHandler ?? listCategories;
  const updateCategoryHandler = options.updateCategoryHandler ?? updateCategory;

  router.get(
    "/categories",
    context.requireAuthMiddleware,
    async (_request, response, next) => {
      try {
        sendSuccess(response, await listCategoriesHandler());
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/categories",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(response, await createCategoryHandler(request.body), {
          statusCode: 201
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    "/categories/:categoryId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await updateCategoryHandler(request.params.categoryId, request.body)
        );
      } catch (error) {
        next(error);
      }
    }
  );
}
