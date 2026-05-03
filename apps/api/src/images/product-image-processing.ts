import type { RequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";
import { createApiError, createValidationError } from "../errors/api-errors";

export const PRODUCT_IMAGE_UPLOAD_FIELD_NAME = "file";
export const PRODUCT_IMAGE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_COUNT = 10;
export const PRODUCT_IMAGE_DISPLAY_MAX_LONG_EDGE = 2000;
export const PRODUCT_IMAGE_DISPLAY_QUALITY = 82;
export const PRODUCT_IMAGE_THUMBNAIL_MAX_LONG_EDGE = 400;
export const PRODUCT_IMAGE_THUMBNAIL_QUALITY = 75;
export const PRODUCT_IMAGE_WEBP_MIME_TYPE = "image/webp";

const SUPPORTED_PRODUCT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const SUPPORTED_SHARP_FORMATS = new Set(["jpeg", "png", "webp"]);

export interface ProcessedProductImageVariant {
  buffer: Buffer;
  contentType: typeof PRODUCT_IMAGE_WEBP_MIME_TYPE;
}

export interface ProcessedProductImage {
  display: ProcessedProductImageVariant;
  thumbnail: ProcessedProductImageVariant;
}

export interface ProductImageStoragePaths {
  displayPath: string;
  thumbnailPath: string;
}

export interface ProductImageUploadFile {
  buffer: Buffer;
  fieldname: string;
  mimetype: string;
  size: number;
}

export function isSupportedProductImageMimeType(mimeType: string) {
  return SUPPORTED_PRODUCT_IMAGE_MIME_TYPES.has(mimeType);
}

export function createProductImageUploadMiddleware(): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: PRODUCT_IMAGE_MAX_FILE_SIZE_BYTES,
      files: 1
    },
    fileFilter: (_request, file, callback) => {
      if (!isSupportedProductImageMimeType(file.mimetype)) {
        callback(createUnsupportedImageTypeError());
        return;
      }

      callback(null, true);
    }
  }).single(PRODUCT_IMAGE_UPLOAD_FIELD_NAME);

  return (request, response, next) => {
    upload(request, response, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(toProductImageUploadError(error));
        return;
      }

      next(error);
    });
  };
}

export function assertProductImageUploadFile(
  file: ProductImageUploadFile | undefined
): asserts file is ProductImageUploadFile {
  if (!file) {
    throw createValidationError([
      {
        field: PRODUCT_IMAGE_UPLOAD_FIELD_NAME,
        message: "画像ファイルを選択してください。"
      }
    ]);
  }

  if (!isSupportedProductImageMimeType(file.mimetype)) {
    throw createUnsupportedImageTypeError();
  }

  if (file.size > PRODUCT_IMAGE_MAX_FILE_SIZE_BYTES) {
    throw createImageTooLargeError();
  }
}

export function assertProductImageCountAvailable(currentImageCount: number) {
  if (currentImageCount >= PRODUCT_IMAGE_MAX_COUNT) {
    throw createImageLimitExceededError();
  }
}

export function getProductImageStoragePaths(
  productId: string,
  imageId: string
): ProductImageStoragePaths {
  return {
    displayPath: `products/${productId}/display/${imageId}.webp`,
    thumbnailPath: `products/${productId}/thumb/${imageId}.webp`
  };
}

export async function processProductImageBuffer(
  sourceBuffer: Buffer
): Promise<ProcessedProductImage> {
  await assertSupportedImageContent(sourceBuffer);

  const [displayBuffer, thumbnailBuffer] = await Promise.all([
    createWebpVariant(
      sourceBuffer,
      PRODUCT_IMAGE_DISPLAY_MAX_LONG_EDGE,
      PRODUCT_IMAGE_DISPLAY_QUALITY
    ),
    createWebpVariant(
      sourceBuffer,
      PRODUCT_IMAGE_THUMBNAIL_MAX_LONG_EDGE,
      PRODUCT_IMAGE_THUMBNAIL_QUALITY
    )
  ]);

  return {
    display: {
      buffer: displayBuffer,
      contentType: PRODUCT_IMAGE_WEBP_MIME_TYPE
    },
    thumbnail: {
      buffer: thumbnailBuffer,
      contentType: PRODUCT_IMAGE_WEBP_MIME_TYPE
    }
  };
}

function createWebpVariant(sourceBuffer: Buffer, maxLongEdge: number, quality: number) {
  return sharp(sourceBuffer)
    .rotate()
    .resize({
      width: maxLongEdge,
      height: maxLongEdge,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({
      quality
    })
    .toBuffer();
}

async function assertSupportedImageContent(sourceBuffer: Buffer) {
  try {
    const metadata = await sharp(sourceBuffer).metadata();

    if (!metadata.format || !SUPPORTED_SHARP_FORMATS.has(metadata.format)) {
      throw createUnsupportedImageTypeError();
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") {
      throw error;
    }

    throw createUnsupportedImageTypeError();
  }
}

function createUnsupportedImageTypeError() {
  return createApiError({
    statusCode: 400,
    code: "UNSUPPORTED_IMAGE_TYPE",
    message: "JPEG、PNG、WebP 形式の画像を選択してください。"
  });
}

function createImageTooLargeError() {
  return createApiError({
    statusCode: 400,
    code: "IMAGE_TOO_LARGE",
    message: "画像サイズは10MB以下にしてください。"
  });
}

function createImageLimitExceededError() {
  return createApiError({
    statusCode: 400,
    code: "IMAGE_LIMIT_EXCEEDED",
    message: "画像は1商品あたり最大10枚まで登録できます。"
  });
}

function toProductImageUploadError(error: multer.MulterError) {
  if (error.code === "LIMIT_FILE_SIZE") {
    return createImageTooLargeError();
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT") {
    return createValidationError([
      {
        field: PRODUCT_IMAGE_UPLOAD_FIELD_NAME,
        message: "画像ファイルは1つだけアップロードしてください。"
      }
    ]);
  }

  return error;
}
