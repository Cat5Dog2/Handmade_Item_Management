import type { TagMutationData } from "@handmade/shared";
import type { Firestore } from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface DeleteTagOptions {
  db?: Firestore;
}

async function assertTagExists(db: Firestore, tagId: string) {
  const snapshot = (await db.collection("tags").doc(tagId).get()) as unknown as {
    exists: boolean;
  };

  if (!snapshot.exists) {
    throw createApiError({
      statusCode: 404,
      code: "TAG_NOT_FOUND",
      message: "対象のタグが見つかりません。最新の一覧を確認してください。"
    });
  }
}

async function assertTagIsUnused(db: Firestore, tagId: string) {
  const snapshot = (await db
    .collection("products")
    .where("isDeleted", "==", false)
    .where("tagIds", "array-contains", tagId)
    .limit(1)
    .get()) as unknown as {
    docs: Array<unknown>;
  };

  if (snapshot.docs.length > 0) {
    throw createApiError({
      statusCode: 400,
      code: "TAG_IN_USE",
      message: "使用中のタグは削除できません。参照中の商品を確認してください。"
    });
  }
}

export async function deleteTag(
  tagId: string,
  options: DeleteTagOptions = {}
): Promise<TagMutationData> {
  const db = options.db ?? getFirestoreDb();
  const tagReference = db.collection("tags").doc(tagId);

  await assertTagExists(db, tagId);
  await assertTagIsUnused(db, tagId);
  await tagReference.delete();

  return {
    tagId
  };
}
