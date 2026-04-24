import type {
  CustomerCreateData,
  CustomerDetailData,
  CustomerListData,
  CustomerListMeta
} from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { createCustomer } from "../customers/create-customer";
import { getCustomer } from "../customers/get-customer";
import { listCustomers } from "../customers/list-customers";
import { sendSuccess } from "../responses/api-response";

interface CustomerListResult {
  data: CustomerListData;
  meta: CustomerListMeta;
}

interface RegisterCustomerRoutesOptions {
  createCustomerHandler?: (input: unknown) => Promise<CustomerCreateData>;
  getCustomerHandler?: (customerId: string) => Promise<CustomerDetailData>;
  listCustomersHandler?: (input: unknown) => Promise<CustomerListResult>;
}

export function registerCustomerRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterCustomerRoutesOptions = {}
) {
  const createCustomerHandler = options.createCustomerHandler ?? createCustomer;
  const getCustomerHandler = options.getCustomerHandler ?? getCustomer;
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

  router.get(
    "/customers/:customerId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await getCustomerHandler(request.params.customerId)
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/customers",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(response, await createCustomerHandler(request.body), {
          statusCode: 201
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
