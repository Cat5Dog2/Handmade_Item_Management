import type {
  CustomerCreateData,
  CustomerDetailData,
  CustomerListData,
  CustomerListMeta,
  CustomerUpdateData
} from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { createCustomer } from "../customers/create-customer";
import { getCustomer } from "../customers/get-customer";
import { listCustomers } from "../customers/list-customers";
import {
  updateCustomer,
  type CustomerUpdateResult
} from "../customers/update-customer";
import { writeOperationLog } from "../operation-logs/write-operation-log";
import { sendSuccess } from "../responses/api-response";

interface CustomerListResult {
  data: CustomerListData;
  meta: CustomerListMeta;
}

interface RegisterCustomerRoutesOptions {
  createCustomerHandler?: (input: unknown) => Promise<CustomerCreateData>;
  getCustomerHandler?: (customerId: string) => Promise<CustomerDetailData>;
  listCustomersHandler?: (input: unknown) => Promise<CustomerListResult>;
  updateCustomerHandler?: (
    customerId: string,
    input: unknown
  ) => Promise<CustomerUpdateResult>;
}

export function registerCustomerRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterCustomerRoutesOptions = {}
) {
  const createCustomerHandler = options.createCustomerHandler ?? createCustomer;
  const getCustomerHandler = options.getCustomerHandler ?? getCustomer;
  const listCustomersHandler = options.listCustomersHandler ?? listCustomers;
  const updateCustomerHandler = options.updateCustomerHandler ?? updateCustomer;

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

  router.put(
    "/customers/:customerId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        const result = await updateCustomerHandler(
          request.params.customerId,
          request.body
        );
        const responseData: CustomerUpdateData = {
          customerId: result.customerId,
          updatedAt: result.updatedAt
        };

        await writeOperationLog({
          eventType: "CUSTOMER_UPDATED",
          targetId: result.customerId,
          summary: "顧客情報を更新しました",
          actorUid: request.authContext?.actorUid ?? null,
          detail: {
            result: "success",
            changedFields: result.changedFields
          }
        });

        sendSuccess(response, responseData);
      } catch (error) {
        next(error);
      }
    }
  );
}
