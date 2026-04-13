import { updateTag } from "./update-tag";

function createTimestamp(isoString: string) {
  return {
    toDate: () => new Date(isoString)
  };
}

function createTagDocument(tagId: string, name: string) {
  return {
    tagId,
    name,
    createdAt: createTimestamp("2026-04-01T00:00:00.000Z") as never,
    updatedAt: createTimestamp("2026-04-02T00:00:00.000Z") as never
  };
}

describe("updateTag", () => {
  it("updates a tag with the normalized name", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const getTagMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => createTagDocument("tag_001", "夏")
    });
    const duplicateCheckMock = vi.fn().mockResolvedValue({
      docs: []
    });
    const docMock = vi.fn().mockReturnValue({
      get: getTagMock,
      update: updateMock
    });
    const tagsCollection = {
      doc: docMock,
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: duplicateCheckMock
        })
      })
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "tags") {
          return tagsCollection;
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    const result = await updateTag(
      "tag_001",
      {
        name: "  春  "
      },
      {
        db: db as never,
        now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never
      }
    );

    expect(result).toEqual({
      tagId: "tag_001"
    });
    expect(tagsCollection.where).toHaveBeenCalledWith("name", "==", "春");
    expect(updateMock).toHaveBeenCalledWith({
      name: "春",
      updatedAt: expect.any(Object)
    });
  });

  it("allows the current tag to keep the same name", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => createTagDocument("tag_001", "春")
          }),
          update: updateMock
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [
                {
                  data: () => ({
                    tagId: "tag_001"
                  })
                }
              ]
            })
          })
        })
      }))
    };

    await expect(
      updateTag(
        "tag_001",
        {
          name: "春"
        },
        {
          db: db as never,
          now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never
        }
      )
    ).resolves.toEqual({
      tagId: "tag_001"
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate tag names owned by another tag", async () => {
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => createTagDocument("tag_001", "春")
          })
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [
                {
                  data: () => ({
                    tagId: "tag_002"
                  })
                }
              ]
            })
          })
        })
      }))
    };

    await expect(
      updateTag(
        "tag_001",
        {
          name: "春"
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
          message: "同じ名前のタグは登録できません。"
        }
      ],
      statusCode: 400
    });
  });

  it("returns TAG_NOT_FOUND when the tag does not exist", async () => {
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
      updateTag(
        "tag_missing",
        {
          name: "春"
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "TAG_NOT_FOUND",
      message: "対象のタグが見つかりません。最新の一覧を確認してください。",
      statusCode: 404
    });
  });

  it("returns validation details for invalid input", async () => {
    await expect(
      updateTag("tag_001", {
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
