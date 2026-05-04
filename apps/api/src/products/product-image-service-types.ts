import type { Timestamp } from "firebase-admin/firestore";
import type { SnapshotLike } from "../guards/firestore-business-guards";

export interface ProductImageDocument {
  displayPath: string;
  imageId: string;
  isPrimary: boolean;
  sortOrder: number;
  thumbnailPath: string;
}

export interface ProductDocument {
  categoryId: string;
  createdAt: Timestamp;
  deletedAt: Timestamp | null;
  description: string;
  images?: ProductImageDocument[] | null;
  isDeleted: boolean;
  name: string;
  price: number;
  productId: string;
  qrCodeValue: string;
  soldAt: Timestamp | null;
  soldCustomerId?: string | null;
  soldCustomerNameSnapshot?: string | null;
  status: string;
  tagIds: string[];
  updatedAt: Timestamp;
}

export interface ProductImageBucketFile {
  delete(): Promise<unknown>;
  save(
    data: Buffer,
    options: {
      contentType: string;
      resumable: boolean;
    }
  ): Promise<unknown>;
}

export interface ProductImageBucket {
  file(path: string): ProductImageBucketFile;
}

export interface FirestoreTransactionLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
  set(reference: unknown, data: unknown): void;
}
