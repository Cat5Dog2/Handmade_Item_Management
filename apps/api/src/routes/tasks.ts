import type { TaskCompletionData, TaskUpdateData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { sendSuccess } from "../responses/api-response";
import { updateTask } from "../tasks/update-task";
import { updateTaskCompletion } from "../tasks/update-task-completion";

interface RegisterTaskRoutesOptions {
  updateTaskHandler?: (
    taskId: string,
    input: unknown
  ) => Promise<TaskUpdateData>;
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
  const updateTaskHandler = options.updateTaskHandler ?? updateTask;
  const updateTaskCompletionHandler =
    options.updateTaskCompletionHandler ?? updateTaskCompletion;

  router.put(
    "/tasks/:taskId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await updateTaskHandler(request.params.taskId, request.body)
        );
      } catch (error) {
        next(error);
      }
    }
  );

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
