import type {
  ProductCreateData,
  ProductListData,
  ProductListMeta
} from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { createProduct } from "../products/create-product";
import { sendSuccess } from "../responses/api-response";
import { listProducts } from "../products/list-products";

interface ProductListResult {
  data: ProductListData;
  meta: ProductListMeta;
}

interface RegisterProductRoutesOptions {
  createProductHandler?: (input: unknown) => Promise<ProductCreateData>;
  listProductsHandler?: (input: unknown) => Promise<ProductListResult>;
}

export function registerProductRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterProductRoutesOptions = {}
) {
  const createProductHandler = options.createProductHandler ?? createProduct;
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
}
