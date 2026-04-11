import {
  categoryInputSchema,
  isoDateSchema,
  productCreateInputSchema,
  productListQuerySchema,
  qrSellInputSchema,
  taskCreateInputSchema
} from "./schemas";

describe("shared schemas", () => {
  it("normalizes product create input for shared reuse", () => {
    expect(
      productCreateInputSchema.parse({
        name: "  Spring Accessory \r\n",
        description: "line1\r\nline2",
        price: "2800",
        categoryId: " cat_001 ",
        tagIds: [" tag_001 ", "tag_002"],
        status: "completed"
      })
    ).toEqual({
      name: "Spring Accessory",
      description: "line1\nline2",
      price: 2800,
      categoryId: "cat_001",
      tagIds: ["tag_001", "tag_002"],
      status: "completed"
    });
  });

  it("coerces product list query strings into normalized values", () => {
    expect(
      productListQuerySchema.parse({
        page: "2",
        pageSize: "25",
        sortBy: "updatedAt",
        sortOrder: "desc",
        keyword: "  Handmade\t Bag  ",
        includeSold: "false"
      })
    ).toEqual({
      page: 2,
      pageSize: 25,
      sortBy: "updatedAt",
      sortOrder: "desc",
      keyword: "handmade bag",
      includeSold: false
    });
  });

  it("treats blank query keywords as unspecified", () => {
    expect(productListQuerySchema.parse({ keyword: " \t " })).toEqual({});
  });

  it("validates due dates and normalizes optional task fields", () => {
    expect(
      taskCreateInputSchema.parse({
        name: "  Prepare Display ",
        content: "line1\r\nline2",
        dueDate: " 2026-04-30 ",
        memo: "memo\r\nline"
      })
    ).toEqual({
      name: "Prepare Display",
      content: "line1\nline2",
      dueDate: "2026-04-30",
      memo: "memo\nline"
    });
    expect(() => isoDateSchema.parse("2026-02-30")).toThrow();
  });

  it("allows nullable category sort order", () => {
    expect(
      categoryInputSchema.parse({
        name: "  Earrings ",
        sortOrder: null
      })
    ).toEqual({
      name: "Earrings",
      sortOrder: null
    });
  });

  it("requires a qr sell identifier", () => {
    expect(() =>
      qrSellInputSchema.parse({
        productId: " ",
        qrCodeValue: ""
      })
    ).toThrow();
    expect(
      qrSellInputSchema.parse({
        productId: " HM-000001 "
      })
    ).toEqual({
      productId: "HM-000001"
    });
  });
});
