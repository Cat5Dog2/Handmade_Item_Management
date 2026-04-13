import { deleteTag } from "./delete-tag";

describe("deleteTag", () => {
  it("deletes an unused tag", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const productReferenceCheckMock = vi.fn().mockResolvedValue({
      docs: []
    });
    const productTagWhereMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        get: productReferenceCheckMock
      })
    });
    const productDeletedWhereMock = vi.fn().mockReturnValue({
      where: productTagWhereMock
    });
    const tagGetMock = vi.fn().mockResolvedValue({
      exists: true
    });
    const tagDocMock = vi.fn().mockReturnValue({
      get: tagGetMock,
      delete: deleteMock
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "tags") {
          return {
            doc: tagDocMock
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

    const result = await deleteTag("tag_001", {
      db: db as never
    });

    expect(result).toEqual({
      tagId: "tag_001"
    });
    expect(productDeletedWhereMock).toHaveBeenCalledWith(
      "isDeleted",
      "==",
      false
    );
    expect(productTagWhereMock).toHaveBeenCalledWith(
      "tagIds",
      "array-contains",
      "tag_001"
    );
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("returns TAG_NOT_FOUND when the tag does not exist", async () => {
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "tags") {
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
      deleteTag("tag_missing", {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "TAG_NOT_FOUND",
      message: "対象のタグが見つかりません。最新の一覧を確認してください。",
      statusCode: 404
    });
  });

  it("returns TAG_IN_USE when an active product references the tag", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "tags") {
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
      deleteTag("tag_001", {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "TAG_IN_USE",
      message: "使用中のタグは削除できません。参照中の商品を確認してください。",
      statusCode: 400
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
