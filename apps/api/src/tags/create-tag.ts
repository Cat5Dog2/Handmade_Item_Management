import { randomUUID } from "node:crypto";
import type { TagInput, TagMutationData } from "@handmade/shared";
import { tagInputSchema } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createApiError, createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface TagDocument {
  tagId: string;
  createdAt: Timestamp;
  name: string;
  updatedAt: Timestamp;
}

interface CreateTagOptions {
  db?: Firestore;
  now?: () => Timestamp;
  tagIdFactory?: () => string;
}

function createTagId() {
  return `tag_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function toValidationErrorDetails(error: ZodError<TagInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

async function assertTagNameIsUnique(db: Firestore, tagName: string) {
  const snapshot = (await db
    .collection("tags")
    .where("name", "==", tagName)
    .limit(1)
    .get()) as unknown as {
    docs: Array<unknown>;
  };

  if (snapshot.docs.length > 0) {
    throw createApiError({
      statusCode: 400,
      code: "DUPLICATE_NAME",
      details: [
        {
          field: "name",
          message: "同じ名前のタグは登録できません。"
        }
      ],
      message: "同じ名前は登録できません。"
    });
  }
}

export async function createTag(
  input: unknown,
  options: CreateTagOptions = {}
): Promise<TagMutationData> {
  const parsedInput = tagInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const tagId = options.tagIdFactory?.() ?? createTagId();
  const tagName = parsedInput.data.name;
  const createdAt = now();
  const tagDocument: TagDocument = {
    tagId,
    name: tagName,
    createdAt,
    updatedAt: createdAt
  };

  await assertTagNameIsUnique(db, tagName);
  await db.collection("tags").doc(tagId).set(tagDocument);

  return {
    tagId
  };
}
