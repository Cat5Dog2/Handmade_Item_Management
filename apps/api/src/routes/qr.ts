import type { QrLookupData, QrSellData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { lookupQrCode } from "../qr/lookup-qr-code";
import { sellQrCode } from "../qr/sell-qr-code";
import { sendSuccess } from "../responses/api-response";

interface RegisterQrRoutesOptions {
  lookupQrCodeHandler?: (input: unknown) => Promise<QrLookupData>;
  sellQrCodeHandler?: (input: unknown) => Promise<QrSellData>;
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
        sendSuccess(response, await sellQrCodeHandler(request.body));
      } catch (error) {
        next(error);
      }
    }
  );
}
