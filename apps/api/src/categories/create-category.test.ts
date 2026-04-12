import { createCategory } from "./create-category";

function createTimestamp(isoString: string) {
  return {
    toDate: () => new Date(isoString)
  };
}

describe("createCategory", () => {
  it("creates a category with the next sortOrder when omitted", async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const getMaxSortOrderMock = vi.fn().mockResolvedValue({
      docs: [
        {
          data: () => ({
            sortOrder: 12
          })
        }
      ]
    });
    const duplicateCheckMock = vi.fn().mockResolvedValue({
      docs: []
    });
    const docMock = vi.fn().mockReturnValue({
      set: setMock
    });
    const categoriesCollection = {
      doc: docMock,
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: getMaxSortOrderMock
        })
      }),
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

    const result = await createCategory(
      {
        name: "  ピアス  "
      },
      {
        db: db as never,
        categoryIdFactory: () => "cat_created",
        now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never
      }
    );

    expect(result).toEqual({
      categoryId: "cat_created"
    });
    expect(categoriesCollection.where).toHaveBeenCalledWith("name", "==", "ピアス");
    expect(setMock).toHaveBeenCalledWith({
      categoryId: "cat_created",
      name: "ピアス",
      sortOrder: 13,
      createdAt: expect.any(Object),
      updatedAt: expect.any(Object)
    });
  });

  it("treats null sortOrder as append to the end", async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const getMaxSortOrderMock = vi.fn().mockResolvedValue({
      docs: [
        {
          data: () => ({
            sortOrder: 4
          })
        }
      ]
    });
    const duplicateCheckMock = vi.fn().mockResolvedValue({
      docs: []
    });
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          set: setMock
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: getMaxSortOrderMock
          })
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: duplicateCheckMock
          })
        })
      }))
    };

    await createCategory(
      {
        name: "ブローチ",
        sortOrder: null
      },
      {
        db: db as never,
        categoryIdFactory: () => "cat_null",
        now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never
      }
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "cat_null",
        name: "ブローチ",
        sortOrder: 5
      })
    );
  });

  it("keeps the explicit sortOrder when provided", async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          set: setMock
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: []
            })
          })
        })
      }))
    };

    await createCategory(
      {
        name: "リング",
        sortOrder: 3
      },
      {
        db: db as never,
        categoryIdFactory: () => "cat_explicit",
        now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never
      }
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortOrder: 3
      })
    );
  });

  it("rejects duplicate category names", async () => {
    const db = {
      collection: vi.fn(() => ({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [{}]
            })
          })
        })
      }))
    };

    await expect(
      createCategory(
        {
          name: "ピアス"
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

  it("returns validation details for invalid input", async () => {
    await expect(
      createCategory({
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
