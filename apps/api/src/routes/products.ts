import type {
  ProductCreateData,
  ProductDeleteData,
  ProductDetailData,
  ProductImageMutationData,
  ProductListData,
  ProductListMeta,
  ProductUpdateData,
  TaskCreateData,
  TaskListData
} from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { createProductImage } from "../products/create-product-image";
import { deleteProduct } from "../products/delete-product";
import { createProduct } from "../products/create-product";
import { getProduct } from "../products/get-product";
import { deleteProductImage } from "../products/delete-product-image";
import { replaceProductImage } from "../products/replace-product-image";
import {
  createProductImageUploadMiddleware,
  type ProductImageUploadFile
} from "../images/product-image-processing";
import { updateProduct } from "../products/update-product";
import { sendSuccess } from "../responses/api-response";
import { listProducts } from "../products/list-products";
import { createProductTask } from "../tasks/create-product-task";
import { listProductTasks } from "../tasks/list-product-tasks";

interface ProductListResult {
  data: ProductListData;
  meta: ProductListMeta;
}

interface RegisterProductRoutesOptions {
  createProductHandler?: (input: unknown) => Promise<ProductCreateData>;
  createProductTaskHandler?: (
    productId: string,
    input: unknown
  ) => Promise<TaskCreateData>;
  createProductImageHandler?: (
    productId: string,
    file: ProductImageUploadFile | undefined
  ) => Promise<ProductImageMutationData>;
  deleteProductImageHandler?: (
    productId: string,
    imageId: string
  ) => Promise<ProductImageMutationData>;
  replaceProductImageHandler?: (
    productId: string,
    imageId: string,
    file: ProductImageUploadFile | undefined
  ) => Promise<ProductImageMutationData>;
  deleteProductHandler?: (productId: string) => Promise<ProductDeleteData>;
  getProductHandler?: (productId: string) => Promise<ProductDetailData>;
  listProductTasksHandler?: (
    productId: string,
    input: unknown
  ) => Promise<TaskListData>;
  updateProductHandler?: (
    productId: string,
    input: unknown
  ) => Promise<ProductUpdateData>;
  listProductsHandler?: (input: unknown) => Promise<ProductListResult>;
}

export function registerProductRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterProductRoutesOptions = {}
) {
  const createProductHandler = options.createProductHandler ?? createProduct;
  const createProductTaskHandler =
    options.createProductTaskHandler ?? createProductTask;
  const createProductImageHandler =
    options.createProductImageHandler ?? createProductImage;
  const deleteProductImageHandler =
    options.deleteProductImageHandler ?? deleteProductImage;
  const replaceProductImageHandler =
    options.replaceProductImageHandler ?? replaceProductImage;
  const deleteProductHandler = options.deleteProductHandler ?? deleteProduct;
  const getProductHandler = options.getProductHandler ?? getProduct;
  const listProductTasksHandler =
    options.listProductTasksHandler ?? listProductTasks;
  const updateProductHandler = options.updateProductHandler ?? updateProduct;
  const listProductsHandler = options.listProductsHandler ?? listProducts;

  router.get(
    "/products",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        const result = await listProductsHandler(request.query);

        sendSuccess(response, result.data, {
          meta: result.meta
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/products/:productId/tasks",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await listProductTasksHandler(request.params.productId, request.query)
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/products/:productId/tasks",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await createProductTaskHandler(
            request.params.productId,
            request.body
          ),
          {
            statusCode: 201
          }
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/products/:productId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await getProductHandler(request.params.productId)
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/products/:productId/images",
    context.requireAuthMiddleware,
    createProductImageUploadMiddleware(),
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await createProductImageHandler(
            request.params.productId,
            request.file
          ),
          {
            statusCode: 201
          }
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    "/products/:productId/images/:imageId",
    context.requireAuthMiddleware,
    createProductImageUploadMiddleware(),
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await replaceProductImageHandler(
            request.params.productId,
            request.params.imageId,
            request.file
          )
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/products/:productId/images/:imageId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await deleteProductImageHandler(
            request.params.productId,
            request.params.imageId
          )
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/products",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(response, await createProductHandler(request.body), {
          statusCode: 201
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    "/products/:productId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await updateProductHandler(request.params.productId, request.body)
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/products/:productId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await deleteProductHandler(request.params.productId)
        );
      } catch (error) {
        next(error);
      }
    }
  );
}
