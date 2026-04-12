import { createSuccessResponse } from "./api-response";

describe("api response helpers", () => {
  it("creates a success payload without meta by default", () => {
    expect(
      createSuccessResponse({
        ok: true
      })
    ).toEqual({
      data: {
        ok: true
      }
    });
  });

  it("includes meta when provided", () => {
    expect(
      createSuccessResponse(
        {
          items: []
        },
        {
          page: 1
        }
      )
    ).toEqual({
      data: {
        items: []
      },
      meta: {
        page: 1
      }
    });
  });
});
