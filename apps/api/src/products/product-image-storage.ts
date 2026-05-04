import type { getProductImageStoragePaths } from "../images/product-image-processing";
import type {
  ProductImageBucket,
  ProductImageBucketFile,
  ProductImageDocument
} from "./product-image-service-types";

type ProductImageStoragePaths = ReturnType<typeof getProductImageStoragePaths>;

function isStorageNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const storageError = error as {
    code?: number | string;
    statusCode?: number;
  };

  return (
    storageError.code === 404 ||
    storageError.code === "404" ||
    storageError.statusCode === 404
  );
}

async function deleteStorageFile(file: ProductImageBucketFile) {
  try {
    await file.delete();
  } catch (error) {
    if (!isStorageNotFoundError(error)) {
      throw error;
    }
  }
}

export async function cleanupProductImageStorageFiles(
  bucket: ProductImageBucket,
  paths: ProductImageStoragePaths
) {
  await Promise.allSettled([
    bucket.file(paths.displayPath).delete(),
    bucket.file(paths.thumbnailPath).delete()
  ]);
}

export async function saveProductImageStorageFiles(
  bucket: ProductImageBucket,
  paths: ProductImageStoragePaths,
  displayBuffer: Buffer,
  thumbnailBuffer: Buffer
) {
  await Promise.all([
    bucket.file(paths.displayPath).save(displayBuffer, {
      contentType: "image/webp",
      resumable: false
    }),
    bucket.file(paths.thumbnailPath).save(thumbnailBuffer, {
      contentType: "image/webp",
      resumable: false
    })
  ]);
}

export async function deleteProductImageStorageFiles(
  bucket: ProductImageBucket,
  paths: Pick<ProductImageDocument, "displayPath" | "thumbnailPath">
) {
  await Promise.all([
    deleteStorageFile(bucket.file(paths.displayPath)),
    deleteStorageFile(bucket.file(paths.thumbnailPath))
  ]);
}
