import type {
  CustomerListData,
  CustomerListMeta
} from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { listCustomers } from "../customers/list-customers";
import { sendSuccess } from "../responses/api-response";

interface CustomerListResult {
  data: CustomerListData;
  meta: CustomerListMeta;
}

interface RegisterCustomerRoutesOptions {
  listCustomersHandler?: (input: unknown) => Promise<CustomerListResult>;
}

export function registerCustomerRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterCustomerRoutesOptions = {}
) {
  const listCustomersHandler = options.listCustomersHandler ?? listCustomers;

  router.get(
    "/customers",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        const result = await listCustomersHandler(request.query);

        sendSuccess(response, result.data, {
          meta: result.meta
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
