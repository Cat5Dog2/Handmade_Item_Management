import type { TagItem, TagListData } from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface TagDocument {
  tagId: string;
  name: string;
  updatedAt: Timestamp;
}

interface ProductTagReferenceDocument {
  tagIds?: string[] | null;
}

interface ListTagsOptions {
  db?: Firestore;
}

function createTagUsageCountMap(
  productSnapshots: Array<QueryDocumentSnapshot<ProductTagReferenceDocument>>
) {
  const usageCountMap = new Map<string, number>();

  productSnapshots.forEach((snapshot) => {
    const tagIds = snapshot.data().tagIds ?? [];

    new Set(tagIds).forEach((tagId) => {
      usageCountMap.set(tagId, (usageCountMap.get(tagId) ?? 0) + 1);
    });
  });

  return usageCountMap;
}

function toTagItem(
  snapshot: QueryDocumentSnapshot<TagDocument>,
  usageCountMap: Map<string, number>
): TagItem {
  const data = snapshot.data();
  const usedProductCount = usageCountMap.get(data.tagId) ?? 0;

  return {
    tagId: data.tagId,
    name: data.name,
    updatedAt: data.updatedAt.toDate().toISOString(),
    usedProductCount,
    isInUse: usedProductCount > 0
  };
}

export async function listTags(
  options: ListTagsOptions = {}
): Promise<TagListData> {
  const db = options.db ?? getFirestoreDb();
  const [tagSnapshot, productSnapshot] = await Promise.all([
    db
      .collection("tags")
      .orderBy("name", "asc")
      .get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<TagDocument>>;
    }>,
    db
      .collection("products")
      .where("isDeleted", "==", false)
      .select("tagIds")
      .get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<ProductTagReferenceDocument>>;
    }>
  ]);
  const usageCountMap = createTagUsageCountMap(productSnapshot.docs);

  return {
    items: tagSnapshot.docs.map((snapshot) =>
      toTagItem(snapshot, usageCountMap)
    )
  };
}
