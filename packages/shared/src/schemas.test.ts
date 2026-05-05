import {
  categoryInputSchema,
  customerInputSchema,
  customerListQuerySchema,
  isoDateSchema,
  productCreateInputSchema,
  productListQuerySchema,
  productUpdateInputSchema,
  qrSellInputSchema,
  taskCreateInputSchema
} from "./schemas";

describe("shared schemas", () => {
  it("normalizes product create input for shared reuse", () => {
    expect(
      productCreateInputSchema.parse({
        name: "  Spring Accessory ",
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
        keyword: "  Handmade  Bag  ",
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

  it("rejects query values outside supported boundaries", () => {
    expect(() =>
      productListQuerySchema.parse({
        keyword: "a".repeat(101)
      })
    ).toThrow();

    expect(() =>
      productListQuerySchema.parse({
        page: "0",
        pageSize: "101"
      })
    ).toThrow();
  });

  it("treats blank query keywords as unspecified", () => {
    expect(productListQuerySchema.parse({ keyword: "   " })).toEqual({});
  });

  it("rejects line breaks and tabs in single-line fields and search keywords", () => {
    expect(() =>
      productCreateInputSchema.parse({
        name: "Spring\nAccessory",
        price: 2800,
        categoryId: "cat_001",
        status: "completed"
      })
    ).toThrow();

    expect(() =>
      taskCreateInputSchema.parse({
        name: "Prepare\tDisplay"
      })
    ).toThrow();

    expect(() =>
      categoryInputSchema.parse({
        name: "Earrings\nSet",
        sortOrder: null
      })
    ).toThrow();

    expect(() =>
      customerListQuerySchema.parse({
        keyword: "Hanako\tInstagram"
      })
    ).toThrow();
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

  it("requires explicit update fields and normalizes nullable primary images", () => {
    expect(
      productUpdateInputSchema.parse({
        name: "  Updated Item ",
        description: "line1\r\nline2",
        price: "3200",
        categoryId: " cat_001 ",
        tagIds: [" tag_001 "],
        status: "sold",
        primaryImageId: "",
        soldCustomerId: ""
      })
    ).toEqual({
      name: "Updated Item",
      description: "line1\nline2",
      price: 3200,
      categoryId: "cat_001",
      tagIds: ["tag_001"],
      status: "sold",
      primaryImageId: null,
      soldCustomerId: null
    });

    expect(() =>
      productUpdateInputSchema.parse({
        name: "Updated Item",
        description: "",
        price: 3200,
        categoryId: "cat_001",
        tagIds: [],
        status: "sold"
      })
    ).toThrow();
  });

  it("rejects category names longer than 50 characters", () => {
    expect(() =>
      categoryInputSchema.parse({
        name: "a".repeat(51),
        sortOrder: 0
      })
    ).toThrow();
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
        customerId: "",
        productId: " HM-000001 "
      })
    ).toEqual({
      customerId: null,
      productId: "HM-000001"
    });
  });

  it("normalizes customer input for shared reuse", () => {
    expect(
      customerInputSchema.parse({
        name: "  山田 花子  ",
        gender: " ",
        ageGroup: " 30代 ",
        customerStyle: " ナチュラル系 ",
        snsAccounts: [
          {
            platform: " Instagram ",
            accountName: " hanako_handmade ",
            url: " https://instagram.com/hanako_handmade ",
            note: "DM購入あり\r\nメモ"
          },
          {
            platform: "",
            accountName: "",
            url: "",
            note: ""
          }
        ],
        memo: " 初回来店\r\nメモ "
      })
    ).toEqual({
      name: "山田 花子",
      gender: null,
      ageGroup: "30代",
      customerStyle: "ナチュラル系",
      snsAccounts: [
        {
          platform: "Instagram",
          accountName: "hanako_handmade",
          url: "https://instagram.com/hanako_handmade",
          note: "DM購入あり\nメモ"
        },
        {
          platform: null,
          accountName: null,
          url: null,
          note: null
        }
      ],
      memo: " 初回来店\nメモ "
    });
  });

  it("coerces customer list query strings into normalized values", () => {
    expect(
      customerListQuerySchema.parse({
        page: "2",
        pageSize: "25",
        keyword: "  Hanako  Instagram  ",
        sortBy: "lastPurchaseAt",
        sortOrder: "asc"
      })
    ).toEqual({
      page: 2,
      pageSize: 25,
      keyword: "hanako instagram",
      sortBy: "lastPurchaseAt",
      sortOrder: "asc"
    });
  });

  it("rejects customer input outside supported boundaries", () => {
    expect(() =>
      customerInputSchema.parse({
        name: ""
      })
    ).toThrow();

    expect(() =>
      customerInputSchema.parse({
        name: "山田 花子",
        customerStyle: "a".repeat(101)
      })
    ).toThrow();

    expect(() =>
      customerInputSchema.parse({
        name: "山田 花子",
        memo: "a".repeat(1001)
      })
    ).toThrow();
  });
});
