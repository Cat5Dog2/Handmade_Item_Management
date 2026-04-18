import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { writeOperationLog } from "../operation-logs/write-operation-log";
import { sendSuccess } from "../responses/api-response";

export function registerAuthRoutes(
  router: Router,
  context: CreateProtectedAppContext
) {
  router.post(
    "/auth/login-record",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        await writeOperationLog({
          eventType: "LOGIN",
          targetId: null,
          summary: "ログインしました",
          actorUid: request.authContext?.actorUid ?? null,
          detail: {
            result: "success"
          }
        });

        sendSuccess(
          response,
          {
            recorded: true
          },
          {
            statusCode: 201
          }
        );
      } catch (error) {
        next(error);
      }
    }
  );
}
