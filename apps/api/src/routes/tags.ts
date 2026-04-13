import type { TagListData } from "@handmade/shared";
import type { Router } from "express";
import type { CreateProtectedAppContext } from "../app";
import { listTags } from "../tags/list-tags";
import { sendSuccess } from "../responses/api-response";

interface RegisterTagRoutesOptions {
  listTagsHandler?: () => Promise<TagListData>;
}

export function registerTagRoutes(
  router: Router,
  context: CreateProtectedAppContext,
  options: RegisterTagRoutesOptions = {}
) {
  const listTagsHandler = options.listTagsHandler ?? listTags;

  router.get("/tags", context.requireAuthMiddleware, async (_request, response, next) => {
    try {
      sendSuccess(response, await listTagsHandler());
    } catch (error) {
      next(error);
    }
  });
}
