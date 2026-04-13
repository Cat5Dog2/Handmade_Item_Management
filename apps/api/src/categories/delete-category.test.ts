import { deleteCategory } from "./delete-category";

describe("deleteCategory", () => {
  it("deletes an unused category", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const productReferenceCheckMock = vi.fn().mockResolvedValue({
      docs: []
    });
    const productCategoryWhereMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        get: productReferenceCheckMock
      })
    });
    const productDeletedWhereMock = vi.fn().mockReturnValue({
      where: productCategoryWhereMock
    });
    const categoryGetMock = vi.fn().mockResolvedValue({
      exists: true
    });
    const categoryDocMock = vi.fn().mockReturnValue({
      get: categoryGetMock,
      delete: deleteMock
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            doc: categoryDocMock
          };
        }

        if (collectionName === "products") {
          return {
            where: productDeletedWhereMock
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    const result = await deleteCategory("cat_001", {
      db: db as never
    });

    expect(result).toEqual({
      categoryId: "cat_001"
    });
    expect(productDeletedWhereMock).toHaveBeenCalledWith(
      "isDeleted",
      "==",
      false
    );
    expect(productCategoryWhereMock).toHaveBeenCalledWith(
      "categoryId",
      "==",
      "cat_001"
    );
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("returns CATEGORY_NOT_FOUND when the category does not exist", async () => {
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: false
              })
            })
          };
        }

        if (collectionName === "products") {
          return {
            where: vi.fn()
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      deleteCategory("cat_missing", {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "CATEGORY_NOT_FOUND",
      message: "対象のカテゴリが見つかりません。最新の一覧を確認してください。",
      statusCode: 404
    });
  });

  it("returns CATEGORY_IN_USE when an active product references the category", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true
              }),
              delete: deleteMock
            })
          };
        }

        if (collectionName === "products") {
          return {
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({
                    docs: [{}]
                  })
                })
              })
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      deleteCategory("cat_001", {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "CATEGORY_IN_USE",
      message: "使用中のカテゴリは削除できません。参照中の商品を確認してください。",
      statusCode: 400
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
