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

interface UpdateTagOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

function toValidationErrorDetails(error: ZodError<TagInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

async function getTagOrThrow(db: Firestore, tagId: string) {
  const snapshot = (await db.collection("tags").doc(tagId).get()) as unknown as {
    data: () => TagDocument;
    exists: boolean;
  };

  if (!snapshot.exists) {
    throw createApiError({
      statusCode: 404,
      code: "TAG_NOT_FOUND",
      message: "対象のタグが見つかりません。最新の一覧を確認してください。"
    });
  }

  return snapshot.data();
}

async function assertTagNameIsUnique(
  db: Firestore,
  tagId: string,
  tagName: string
) {
  const snapshot = (await db
    .collection("tags")
    .where("name", "==", tagName)
    .limit(2)
    .get()) as unknown as {
    docs: Array<{
      data: () => {
        tagId: string;
      };
    }>;
  };
  const hasDuplicate = snapshot.docs.some(
    (documentSnapshot) => documentSnapshot.data().tagId !== tagId
  );

  if (hasDuplicate) {
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

export async function updateTag(
  tagId: string,
  input: unknown,
  options: UpdateTagOptions = {}
): Promise<TagMutationData> {
  const parsedInput = tagInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const tagReference = db.collection("tags").doc(tagId);
  const tagName = parsedInput.data.name;

  await getTagOrThrow(db, tagId);
  await assertTagNameIsUnique(db, tagId, tagName);

  await tagReference.update({
    name: tagName,
    updatedAt: now()
  });

  return {
    tagId
  };
}
