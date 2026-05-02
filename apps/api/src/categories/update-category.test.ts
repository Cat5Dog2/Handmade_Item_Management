import { createTimestamp } from "../test/firestore-test-helpers";
import { updateCategory } from "./update-category";

function createCategoryDocument(categoryId: string, name: string, sortOrder: number) {
  return {
    categoryId,
    name,
    sortOrder,
    createdAt: createTimestamp("2026-04-01T00:00:00.000Z") as never,
    updatedAt: createTimestamp("2026-04-02T00:00:00.000Z") as never
  };
}

describe("updateCategory", () => {
  it("updates a category with the normalized name and explicit sortOrder", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const getCategoryMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => createCategoryDocument("cat_001", "イヤリング", 1)
    });
    const duplicateCheckMock = vi.fn().mockResolvedValue({
      docs: []
    });
    const docMock = vi.fn().mockReturnValue({
      get: getCategoryMock,
      update: updateMock
    });
    const categoriesCollection = {
      doc: docMock,
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: duplicateCheckMock
        })
      })
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return categoriesCollection;
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    const result = await updateCategory(
      "cat_001",
      {
        name: "  ピアス  ",
        sortOrder: 3
      },
      {
        db: db as never,
        now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never
      }
    );

    expect(result).toEqual({
      categoryId: "cat_001"
    });
    expect(categoriesCollection.where).toHaveBeenCalledWith("name", "==", "ピアス");
    expect(updateMock).toHaveBeenCalledWith({
      name: "ピアス",
      sortOrder: 3,
      updatedAt: expect.any(Object)
    });
  });

  it("moves the category to the end when sortOrder is null", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const getCategoryMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => createCategoryDocument("cat_001", "イヤリング", 1)
    });
    const duplicateCheckMock = vi.fn().mockResolvedValue({
      docs: []
    });
    const getMaxSortOrderMock = vi.fn().mockResolvedValue({
      docs: [
        {
          data: () => ({
            sortOrder: 8
          })
        }
      ]
    });
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: getCategoryMock,
          update: updateMock
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: duplicateCheckMock
          })
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: getMaxSortOrderMock
          })
        })
      }))
    };

    await updateCategory(
      "cat_001",
      {
        name: "イヤリング",
        sortOrder: null
      },
      {
        db: db as never,
        now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never
      }
    );

    expect(updateMock).toHaveBeenCalledWith({
      name: "イヤリング",
      sortOrder: 9,
      updatedAt: expect.any(Object)
    });
  });

  it("allows the current category to keep the same name", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => createCategoryDocument("cat_001", "ピアス", 1)
          }),
          update: updateMock
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [
                {
                  data: () => ({
                    categoryId: "cat_001"
                  })
                }
              ]
            })
          })
        })
      }))
    };

    await expect(
      updateCategory(
        "cat_001",
        {
          name: "ピアス",
          sortOrder: 4
        },
        {
          db: db as never,
          now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never
        }
      )
    ).resolves.toEqual({
      categoryId: "cat_001"
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate category names owned by another category", async () => {
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => createCategoryDocument("cat_001", "ピアス", 1)
          })
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [
                {
                  data: () => ({
                    categoryId: "cat_002"
                  })
                }
              ]
            })
          })
        })
      }))
    };

    await expect(
      updateCategory(
        "cat_001",
        {
          name: "ピアス",
          sortOrder: 4
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "DUPLICATE_NAME",
      details: [
        {
          field: "name",
          message: "同じ名前のカテゴリは登録できません。"
        }
      ],
      statusCode: 400
    });
  });

  it("returns CATEGORY_NOT_FOUND when the category does not exist", async () => {
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: false
          })
        })
      }))
    };

    await expect(
      updateCategory(
        "cat_missing",
        {
          name: "ピアス",
          sortOrder: 1
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "CATEGORY_NOT_FOUND",
      message: "対象のカテゴリが見つかりません。最新の一覧を確認してください。",
      statusCode: 404
    });
  });

  it("returns validation details for invalid input", async () => {
    await expect(
      updateCategory("cat_001", {
        name: "   "
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [
        {
          field: "name",
          message: "String must contain at least 1 character(s)"
        }
      ],
      statusCode: 400
    });
  });
});
