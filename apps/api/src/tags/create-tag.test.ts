import { createTag } from "./create-tag";

function createTimestamp(isoString: string) {
  return {
    toDate: () => new Date(isoString)
  };
}

describe("createTag", () => {
  it("creates a tag with the normalized name", async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const duplicateCheckMock = vi.fn().mockResolvedValue({
      docs: []
    });
    const docMock = vi.fn().mockReturnValue({
      set: setMock
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

    const result = await createTag(
      {
        name: "  春  "
      },
      {
        db: db as never,
        now: () => createTimestamp("2026-04-13T00:00:00.000Z") as never,
        tagIdFactory: () => "tag_created"
      }
    );

    expect(result).toEqual({
      tagId: "tag_created"
    });
    expect(tagsCollection.where).toHaveBeenCalledWith("name", "==", "春");
    expect(setMock).toHaveBeenCalledWith({
      tagId: "tag_created",
      name: "春",
      createdAt: expect.any(Object),
      updatedAt: expect.any(Object)
    });
  });

  it("rejects duplicate tag names", async () => {
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
      createTag(
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

  it("returns validation details for invalid input", async () => {
    await expect(
      createTag({
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
