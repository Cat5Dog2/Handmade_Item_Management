import type { CustomerPurchaseItem, CustomerPurchasesData } from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface CustomerDocument {
  customerId: string;
}

interface ProductDocument {
  isDeleted: boolean;
  name: string;
  price: number;
  productId: string;
  soldAt: Timestamp | null;
  soldCustomerId?: string | null;
  status: "sold";
  updatedAt: Timestamp;
}

interface SnapshotLike<T> {
  data: () => T;
  exists: boolean;
}

interface GetCustomerPurchasesOptions {
  db?: Firestore;
}

function compareNullableDatesDescending(left: Date | null, right: Date | null) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return right.getTime() - left.getTime();
}

function toCustomerPurchaseItem(
  snapshot: QueryDocumentSnapshot<ProductDocument>
): CustomerPurchaseItem {
  const product = snapshot.data();
  const soldAt = product.soldAt ?? product.updatedAt;

  return {
    productId: product.productId,
    name: product.name,
    price: product.price,
    soldAt: soldAt.toDate().toISOString()
  };
}

export async function getCustomerPurchases(
  customerId: string,
  options: GetCustomerPurchasesOptions = {}
): Promise<CustomerPurchasesData> {
  const db = options.db ?? getFirestoreDb();
  const customerReference = db.collection("customers").doc(customerId);
  const customerSnapshot = (await customerReference.get()) as unknown as SnapshotLike<CustomerDocument>;

  if (!customerSnapshot.exists) {
    throw createApiError({
      statusCode: 404,
      code: "CUSTOMER_NOT_FOUND",
      message: "\u6307\u5b9a\u3057\u305f\u9867\u5ba2\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002"
    });
  }

  const productSnapshot = (await db
    .collection("products")
    .where("isDeleted", "==", false)
    .where("status", "==", "sold")
    .where("soldCustomerId", "==", customerId)
    .get()) as unknown as {
    docs: Array<QueryDocumentSnapshot<ProductDocument>>;
  };

  const items = productSnapshot.docs
    .slice()
    .sort((left, right) => {
      const leftProduct = left.data();
      const rightProduct = right.data();
      const leftSoldAt = leftProduct.soldAt ? leftProduct.soldAt.toDate() : null;
      const rightSoldAt = rightProduct.soldAt ? rightProduct.soldAt.toDate() : null;
      const soldAtComparison = compareNullableDatesDescending(
        leftSoldAt,
        rightSoldAt
      );

      if (soldAtComparison !== 0) {
        return soldAtComparison;
      }

      return leftProduct.productId.localeCompare(rightProduct.productId);
    })
    .map((snapshot) => toCustomerPurchaseItem(snapshot));

  return {
    items
  };
}
