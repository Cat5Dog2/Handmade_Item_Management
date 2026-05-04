import { createApiError } from "../errors/api-errors";

export function createImageNotFoundError() {
  return createApiError({
    statusCode: 404,
    code: "IMAGE_NOT_FOUND",
    message: "対象の画像が見つかりません。最新の情報を読み込み直してください。"
  });
}
