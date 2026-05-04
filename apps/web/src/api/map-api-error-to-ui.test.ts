import { describe, expect, it } from "vitest";
import { ApiClientError } from "./api-client";
import { mapApiErrorToUi } from "./map-api-error-to-ui";

describe("mapApiErrorToUi", () => {
  it("normalizes ApiClientError values into UI error payloads", () => {
    expect(
      mapApiErrorToUi(
        new ApiClientError(400, {
          code: "VALIDATION_ERROR",
          details: [
            {
              field: " name ",
              message: " 入力内容を確認してください。 "
            }
          ],
          message: "server-side message"
        }),
        {
          fallbackMessage: "保存できませんでした。"
        }
      )
    ).toEqual({
      code: "VALIDATION_ERROR",
      details: [
        {
          field: "name",
          message: "入力内容を確認してください。"
        }
      ],
      message: "入力内容を確認してください。",
      status: 400
    });
  });

  it("falls back for non ApiClientError values", () => {
    expect(
      mapApiErrorToUi(new Error("network error"), {
        fallbackMessage: "一覧を取得できませんでした。"
      })
    ).toEqual({
      code: null,
      details: [],
      message: "一覧を取得できませんでした。",
      status: null
    });
  });
});

