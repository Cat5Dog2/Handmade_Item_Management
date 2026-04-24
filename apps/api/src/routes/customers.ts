import type {
  CustomerArchiveData,
  CustomerCreateData,
  CustomerDetailData,
  CustomerListData,
  CustomerListMeta,
  CustomerPurchasesData,
  CustomerUpdateData
} from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import {
  archiveCustomer,
  type CustomerArchiveResult
} from "../customers/archive-customer";
import { createCustomer } from "../customers/create-customer";
import { getCustomer } from "../customers/get-customer";
import { getCustomerPurchases } from "../customers/get-customer-purchases";
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
  archiveCustomerHandler?: (
    customerId: string
  ) => Promise<CustomerArchiveResult>;
  createCustomerHandler?: (input: unknown) => Promise<CustomerCreateData>;
  getCustomerHandler?: (customerId: string) => Promise<CustomerDetailData>;
  getCustomerPurchasesHandler?: (
    customerId: string
  ) => Promise<CustomerPurchasesData>;
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
  const archiveCustomerHandler = options.archiveCustomerHandler ?? archiveCustomer;
  const createCustomerHandler = options.createCustomerHandler ?? createCustomer;
  const getCustomerHandler = options.getCustomerHandler ?? getCustomer;
  const getCustomerPurchasesHandler =
    options.getCustomerPurchasesHandler ?? getCustomerPurchases;
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

  router.get(
    "/customers/:customerId/purchases",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await getCustomerPurchasesHandler(request.params.customerId)
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

  router.delete(
    "/customers/:customerId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        const result = await archiveCustomerHandler(request.params.customerId);
        const responseData: CustomerArchiveData = {
          customerId: result.customerId,
          archivedAt: result.archivedAt,
          updatedAt: result.updatedAt
        };

        if (result.didArchive) {
          await writeOperationLog({
            eventType: "CUSTOMER_ARCHIVED",
            targetId: result.customerId,
            summary:
              "\u9867\u5ba2\u3092\u30a2\u30fc\u30ab\u30a4\u30d6\u3057\u307e\u3057\u305f",
            actorUid: request.authContext?.actorUid ?? null,
            detail: {
              result: "success"
            }
          });
        }

        sendSuccess(response, responseData);
      } catch (error) {
        next(error);
      }
    }
  );
}
