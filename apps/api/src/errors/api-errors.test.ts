import {
  createAuthForbiddenError,
  createAuthRequiredError,
  createValidationError,
  toApiErrorResponse
} from "./api-errors";

describe("api error helpers", () => {
  it("creates a validation error with details", () => {
    const error = createValidationError([
      {
        field: "name",
        message: "商品名を入力してください。"
      }
    ]);

    expect(error.statusCode).toBe(400);
    expect(toApiErrorResponse(error)).toEqual({
      code: "VALIDATION_ERROR",
      message: "入力内容を確認してください。",
      details: [
        {
          field: "name",
          message: "商品名を入力してください。"
        }
      ]
    });
  });

  it("creates unified auth errors", () => {
    expect(toApiErrorResponse(createAuthRequiredError())).toEqual({
      code: "AUTH_REQUIRED",
      message: "セッションが切れました。再度ログインしてください。"
    });

    expect(toApiErrorResponse(createAuthForbiddenError())).toEqual({
      code: "AUTH_FORBIDDEN",
      message: "この操作は実行できません。"
    });
  });
});
