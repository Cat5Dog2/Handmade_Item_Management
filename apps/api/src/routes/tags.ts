import type { TagListData, TagMutationData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { createTag } from "../tags/create-tag";
import { listTags } from "../tags/list-tags";
import { sendSuccess } from "../responses/api-response";

interface RegisterTagRoutesOptions {
  createTagHandler?: (input: unknown) => Promise<TagMutationData>;
  listTagsHandler?: () => Promise<TagListData>;
}

export function registerTagRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterTagRoutesOptions = {}
) {
  const createTagHandler = options.createTagHandler ?? createTag;
  const listTagsHandler = options.listTagsHandler ?? listTags;

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
}
