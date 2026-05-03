import type {
  TaskCompletionData,
  TaskDeleteData,
  TaskUpdateData
} from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { sendSuccess } from "../responses/api-response";
import { deleteTask } from "../tasks/delete-task";
import { updateTask } from "../tasks/update-task";
import { updateTaskCompletion } from "../tasks/update-task-completion";

interface RegisterTaskRoutesOptions {
  deleteTaskHandler?: (taskId: string) => Promise<TaskDeleteData>;
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
  const deleteTaskHandler = options.deleteTaskHandler ?? deleteTask;
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

  router.delete(
    "/tasks/:taskId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(response, await deleteTaskHandler(request.params.taskId));
      } catch (error) {
        next(error);
      }
    }
  );
}
