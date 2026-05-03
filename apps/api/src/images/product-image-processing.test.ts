import express, { type NextFunction, type Request, type Response } from "express";
import sharp from "sharp";
import request from "supertest";
import { AppError } from "../errors/app-error";
import {
  assertProductImageCountAvailable,
  assertProductImageUploadFile,
  createProductImageUploadMiddleware,
  getProductImageStoragePaths,
  PRODUCT_IMAGE_MAX_COUNT,
  PRODUCT_IMAGE_MAX_FILE_SIZE_BYTES,
  PRODUCT_IMAGE_UPLOAD_FIELD_NAME,
  PRODUCT_IMAGE_WEBP_MIME_TYPE,
  type ProductImageUploadFile,
  processProductImageBuffer
} from "./product-image-processing";

describe("product image processing", () => {
  it("creates display and thumbnail WebP buffers within configured long edges", async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 2600,
        height: 1200,
        channels: 3,
        background: "#f5c6d6"
      }
    })
      .jpeg()
      .toBuffer();

    const result = await processProductImageBuffer(sourceBuffer);
    const displayMetadata = await sharp(result.display.buffer).metadata();
    const thumbnailMetadata = await sharp(result.thumbnail.buffer).metadata();

    expect(result.display.contentType).toBe(PRODUCT_IMAGE_WEBP_MIME_TYPE);
    expect(result.thumbnail.contentType).toBe(PRODUCT_IMAGE_WEBP_MIME_TYPE);
    expect(displayMetadata.format).toBe("webp");
    expect(displayMetadata.width).toBe(2000);
    expect(displayMetadata.height).toBe(923);
    expect(thumbnailMetadata.format).toBe("webp");
    expect(thumbnailMetadata.width).toBe(400);
    expect(thumbnailMetadata.height).toBe(185);
  });

  it("does not enlarge images that are smaller than the display and thumbnail limits", async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: "#8fd7c7"
      }
    })
      .png()
      .toBuffer();

    const result = await processProductImageBuffer(sourceBuffer);
    const displayMetadata = await sharp(result.display.buffer).metadata();
    const thumbnailMetadata = await sharp(result.thumbnail.buffer).metadata();

    expect(displayMetadata.width).toBe(320);
    expect(displayMetadata.height).toBe(240);
    expect(thumbnailMetadata.width).toBe(320);
    expect(thumbnailMetadata.height).toBe(240);
  });

  it("rejects a buffer that is not a supported image", async () => {
    await expect(
      processProductImageBuffer(Buffer.from("not an image"))
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "UNSUPPORTED_IMAGE_TYPE"
    });
  });

  it("keeps upload files in memory and accepts JPEG, PNG, and WebP MIME types", async () => {
    const app = createUploadTestApp();
    const sourceBuffer = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: "#ffffff"
      }
    })
      .webp()
      .toBuffer();

    const response = await request(app)
      .post("/upload")
      .attach(PRODUCT_IMAGE_UPLOAD_FIELD_NAME, sourceBuffer, {
        filename: "sample.webp",
        contentType: "image/webp"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      bufferLength: sourceBuffer.length,
      fieldname: PRODUCT_IMAGE_UPLOAD_FIELD_NAME,
      mimetype: "image/webp"
    });
  });

  it("rejects unsupported upload MIME types before processing", async () => {
    const app = createUploadTestApp();

    const response = await request(app)
      .post("/upload")
      .attach(PRODUCT_IMAGE_UPLOAD_FIELD_NAME, Buffer.from("plain text"), {
        filename: "sample.txt",
        contentType: "text/plain"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "UNSUPPORTED_IMAGE_TYPE"
    });
  });

  it("maps upload files larger than 10MB to the image size error", async () => {
    const app = createUploadTestApp();

    const response = await request(app)
      .post("/upload")
      .attach(
        PRODUCT_IMAGE_UPLOAD_FIELD_NAME,
        Buffer.alloc(PRODUCT_IMAGE_MAX_FILE_SIZE_BYTES + 1),
        {
          filename: "large.png",
          contentType: "image/png"
        }
      );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "IMAGE_TOO_LARGE"
    });
  });
});

describe("product image upload validation", () => {
  it("rejects missing files with a field validation error", () => {
    expect(() => assertProductImageUploadFile(undefined)).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        details: [
          {
            field: PRODUCT_IMAGE_UPLOAD_FIELD_NAME,
            message: "画像ファイルを選択してください。"
          }
        ]
      })
    );
  });

  it("rejects unsupported MIME types", () => {
    expect(() =>
      assertProductImageUploadFile(
        createMulterFile({
          mimetype: "image/gif"
        })
      )
    ).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        code: "UNSUPPORTED_IMAGE_TYPE"
      })
    );
  });

  it("rejects files larger than 10MB", () => {
    expect(() =>
      assertProductImageUploadFile(
        createMulterFile({
          size: PRODUCT_IMAGE_MAX_FILE_SIZE_BYTES + 1
        })
      )
    ).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        code: "IMAGE_TOO_LARGE"
      })
    );
  });

  it("rejects the eleventh product image", () => {
    expect(() =>
      assertProductImageCountAvailable(PRODUCT_IMAGE_MAX_COUNT)
    ).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        code: "IMAGE_LIMIT_EXCEEDED"
      })
    );
  });
});

describe("product image storage paths", () => {
  it("uses the product image display and thumbnail WebP paths", () => {
    expect(getProductImageStoragePaths("HM-000123", "img_abc")).toEqual({
      displayPath: "products/HM-000123/display/img_abc.webp",
      thumbnailPath: "products/HM-000123/thumb/img_abc.webp"
    });
  });
});

function createMulterFile(
  overrides: Partial<ProductImageUploadFile> = {}
): ProductImageUploadFile {
  const buffer = Buffer.from("image");

  return {
    buffer,
    fieldname: PRODUCT_IMAGE_UPLOAD_FIELD_NAME,
    mimetype: "image/jpeg",
    size: buffer.length,
    ...overrides
  };
}

function createUploadTestApp() {
  const app = express();

  app.post(
    "/upload",
    createProductImageUploadMiddleware(),
    (request: Request, response: Response) => {
      assertProductImageUploadFile(request.file);

      response.status(200).json({
        bufferLength: request.file.buffer.length,
        fieldname: request.file.fieldname,
        mimetype: request.file.mimetype
      });
    }
  );

  app.use(
    (
      error: Error,
      _request: Request,
      response: Response,
      next: NextFunction
    ) => {
      void next;

      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          code: error.code
        });
        return;
      }

      response.status(500).json({
        code: "INTERNAL_ERROR"
      });
    }
  );

  return app;
}
