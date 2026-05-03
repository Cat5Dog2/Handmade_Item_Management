import type { TaskCompletionData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { sendSuccess } from "../responses/api-response";
import { updateTaskCompletion } from "../tasks/update-task-completion";

interface RegisterTaskRoutesOptions {
  updateTaskCompletionHandler?: (
    taskId: string,
    input: unknown
  ) => Promise<TaskCompletionData>;
}

export function registerTaskRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterTaskRoutesOptions = {}
) {
  const updateTaskCompletionHandler =
    options.updateTaskCompletionHandler ?? updateTaskCompletion;

  router.patch(
    "/tasks/:taskId/completion",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await updateTaskCompletionHandler(
            request.params.taskId,
            request.body
          )
        );
      } catch (error) {
        next(error);
      }
    }
  );
}
