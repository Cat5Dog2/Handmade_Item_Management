import { describe, expect, it } from "vitest";
import { ApiClientError } from "./api-client";
import { getApiErrorDisplayMessage } from "./api-error-display";

describe("getApiErrorDisplayMessage", () => {
  it("returns the fallback message for non ApiClientError values", () => {
    expect(
      getApiErrorDisplayMessage(new Error("network error"), {
        fallbackMessage: "一覧を取得できませんでした。"
      })
    ).toBe("一覧を取得できませんでした。");
  });

  it("uses the built-in default message for known error codes", () => {
    expect(
      getApiErrorDisplayMessage(
        new ApiClientError(400, {
          code: "CATEGORY_IN_USE",
          message: "server-side message"
        }),
        {
          fallbackMessage: "保存できませんでした。"
        }
      )
    ).toBe("使用中のカテゴリは削除できません。");
  });

  it("uses an override message for configured error codes", () => {
    expect(
      getApiErrorDisplayMessage(
        new ApiClientError(404, {
          code: "PRODUCT_NOT_FOUND",
          message: "指定した商品が見つかりません。"
        }),
        {
          codeMessages: {
            PRODUCT_NOT_FOUND: "対象の商品が見つかりません。"
          },
          fallbackMessage: "商品詳細を取得できませんでした。"
        }
      )
    ).toBe("対象の商品が見つかりません。");
  });

  it("uses the fallback message for configured fallback codes", () => {
    expect(
      getApiErrorDisplayMessage(
        new ApiClientError(500, {
          code: "INTERNAL_ERROR",
          message: "予期しないエラーが発生しました。"
        }),
        {
          fallbackMessage: "ダッシュボードの取得に失敗しました。",
          fallbackMessageCodes: ["INTERNAL_ERROR"]
        }
      )
    ).toBe("ダッシュボードの取得に失敗しました。");
  });
});
