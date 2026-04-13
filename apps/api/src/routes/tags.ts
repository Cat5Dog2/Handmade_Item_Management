import type { TagListData, TagMutationData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { createTag } from "../tags/create-tag";
import { deleteTag } from "../tags/delete-tag";
import { listTags } from "../tags/list-tags";
import { updateTag } from "../tags/update-tag";
import { sendSuccess } from "../responses/api-response";

interface RegisterTagRoutesOptions {
  createTagHandler?: (input: unknown) => Promise<TagMutationData>;
  deleteTagHandler?: (tagId: string) => Promise<TagMutationData>;
  listTagsHandler?: () => Promise<TagListData>;
  updateTagHandler?: (
    tagId: string,
    input: unknown
  ) => Promise<TagMutationData>;
}

export function registerTagRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterTagRoutesOptions = {}
) {
  const createTagHandler = options.createTagHandler ?? createTag;
  const deleteTagHandler = options.deleteTagHandler ?? deleteTag;
  const listTagsHandler = options.listTagsHandler ?? listTags;
  const updateTagHandler = options.updateTagHandler ?? updateTag;

  router.get(
    "/tags",
    context.requireAuthMiddleware,
    async (_request, response, next) => {
      try {
        sendSuccess(response, await listTagsHandler());
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/tags",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(response, await createTagHandler(request.body), {
          statusCode: 201
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    "/tags/:tagId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(
          response,
          await updateTagHandler(request.params.tagId, request.body)
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/tags/:tagId",
    context.requireAuthMiddleware,
    async (request, response, next) => {
      try {
        sendSuccess(response, await deleteTagHandler(request.params.tagId));
      } catch (error) {
        next(error);
      }
    }
  );
}
