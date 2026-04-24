import type { QrLookupData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { lookupQrCode } from "../qr/lookup-qr-code";
import { sendSuccess } from "../responses/api-response";

interface RegisterQrRoutesOptions {
  lookupQrCodeHandler?: (input: unknown) => Promise<QrLookupData>;
}

export function registerQrRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterQrRoutesOptions = {}
) {
  const lookupQrCodeHandler = options.lookupQrCodeHandler ?? lookupQrCode;

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
}
