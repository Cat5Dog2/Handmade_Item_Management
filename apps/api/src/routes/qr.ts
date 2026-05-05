import type { QrLookupData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { lookupQrCode } from "../qr/lookup-qr-code";
import { sellQrCode, type QrSellResult } from "../qr/sell-qr-code";
import { writeOperationLogSafely } from "../operation-logs/write-operation-log-safely";
import { sendSuccess } from "../responses/api-response";

interface RegisterQrRoutesOptions {
  lookupQrCodeHandler?: (input: unknown) => Promise<QrLookupData>;
  sellQrCodeHandler?: (input: unknown) => Promise<QrSellResult>;
}

export function registerQrRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterQrRoutesOptions = {}
) {
  const lookupQrCodeHandler = options.lookupQrCodeHandler ?? lookupQrCode;
  const sellQrCodeHandler = options.sellQrCodeHandler ?? sellQrCode;

  router.post(
    "/qr/lookup",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(response, await lookupQrCodeHandler(request.body));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/qr/sell",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        const result = await sellQrCodeHandler(request.body);

        await writeOperationLogSafely({
          eventType: "QR_SOLD",
          targetId: result.productId,
          summary: "商品を販売済に更新しました",
          actorUid: request.authContext?.actorUid ?? null,
          detail: {
            previousStatus: result.previousStatus
          }
        }, context.logger);

        sendSuccess(response, {
          productId: result.productId,
          status: result.status,
          soldAt: result.soldAt,
          soldCustomerId: result.soldCustomerId,
          soldCustomerNameSnapshot: result.soldCustomerNameSnapshot,
          updatedAt: result.updatedAt
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
