import type { CategoryItem, CategoryListData } from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface CategoryDocument {
  categoryId: string;
  name: string;
  sortOrder: number;
  updatedAt: Timestamp;
}

interface ProductCategoryReferenceDocument {
  categoryId?: string | null;
}

interface ListCategoriesOptions {
  db?: Firestore;
}

function createCategoryUsageCountMap(
  productSnapshots: Array<QueryDocumentSnapshot<ProductCategoryReferenceDocument>>
) {
  const usageCountMap = new Map<string, number>();

  productSnapshots.forEach((snapshot) => {
    const categoryId = snapshot.data().categoryId;

    if (!categoryId) {
      return;
    }

    usageCountMap.set(categoryId, (usageCountMap.get(categoryId) ?? 0) + 1);
  });

  return usageCountMap;
}

function toCategoryItem(
  snapshot: QueryDocumentSnapshot<CategoryDocument>,
  usageCountMap: Map<string, number>
): CategoryItem {
  const data = snapshot.data();
  const usedProductCount = usageCountMap.get(data.categoryId) ?? 0;

  return {
    categoryId: data.categoryId,
    name: data.name,
    sortOrder: data.sortOrder,
    updatedAt: data.updatedAt.toDate().toISOString(),
    usedProductCount,
    isInUse: usedProductCount > 0
  };
}

export async function listCategories(
  options: ListCategoriesOptions = {}
): Promise<CategoryListData> {
  const db = options.db ?? getFirestoreDb();
  const [categorySnapshot, productSnapshot] = await Promise.all([
    db
      .collection("categories")
      .orderBy("sortOrder", "asc")
      .orderBy("name", "asc")
      .get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<CategoryDocument>>;
    }>,
    db
      .collection("products")
      .where("isDeleted", "==", false)
      .select("categoryId")
      .get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<ProductCategoryReferenceDocument>>;
    }>
  ]);
  const usageCountMap = createCategoryUsageCountMap(productSnapshot.docs);

  return {
    items: categorySnapshot.docs.map((snapshot) =>
      toCategoryItem(snapshot, usageCountMap)
    )
  };
}
