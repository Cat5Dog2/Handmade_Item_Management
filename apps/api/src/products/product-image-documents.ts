import { createImageNotFoundError } from "./product-image-errors";
import type { ProductImageDocument } from "./product-image-service-types";

export function sortProductImages(images: ProductImageDocument[]) {
  return [...images].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.imageId.localeCompare(right.imageId);
  });
}

export function findProductImageOrThrow(
  images: ProductImageDocument[] | null | undefined,
  imageId: string
) {
  const image = sortProductImages(images ?? []).find(
    (candidate) => candidate.imageId === imageId
  );

  if (!image) {
    throw createImageNotFoundError();
  }

  return image;
}
