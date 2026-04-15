import { QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { vi } from "vitest";
import { ApiClientError } from "../api/api-client";
import { createAppQueryClient } from "../api/query-client";
import { TagManagementPage } from "./tag-management-page";

const apiClientMock = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  request: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

function renderPage() {
  const queryClient = createAppQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <TagManagementPage />
    </QueryClientProvider>
  );
}

describe("TagManagementPage", () => {
  beforeEach(() => {
    apiClientMock.delete.mockReset();
    apiClientMock.get.mockReset();
    apiClientMock.patch.mockReset();
    apiClientMock.post.mockReset();
    apiClientMock.put.mockReset();
    apiClientMock.request.mockReset();
  });

  it("renders the tag list and keeps delete disabled for in-use items", async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        items: [
          {
            isInUse: true,
            name: "新作",
            tagId: "tag_001",
            updatedAt: "2026-04-10T09:00:00.000Z",
            usedProductCount: 2
          },
          {
            isInUse: false,
            name: "春",
            tagId: "tag_002",
            updatedAt: "2026-04-11T09:00:00.000Z",
            usedProductCount: 0
          }
        ]
      }
    });

    renderPage();

    const cards = await screen.findAllByRole("listitem");

    expect(
      cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)
    ).toEqual(["新作", "春"]);
    expect(
      within(cards[0] as HTMLElement).getByRole("button", { name: "削除する" })
    ).toBeDisabled();
    expect(
      within(cards[0] as HTMLElement).getByText("使用中のため削除できません。")
    ).toBeInTheDocument();
    expect(
      within(cards[1] as HTMLElement).getByRole("button", { name: "削除する" })
    ).toBeEnabled();
  });

  it("creates a tag and refreshes the list", async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        data: {
          items: []
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              isInUse: false,
              name: "限定",
              tagId: "tag_010",
              updatedAt: "2026-04-12T09:00:00.000Z",
              usedProductCount: 0
            }
          ]
        }
      });
    apiClientMock.post.mockResolvedValue({
      data: {
        tagId: "tag_010"
      }
    });

    renderPage();

    await screen.findByText(
      "タグはまだ登録されていません。最初のタグを登録してください。"
    );

    const nameInput = screen.getByLabelText("タグ名");

    fireEvent.input(nameInput, {
      target: { value: "限定" }
    });
    fireEvent.blur(nameInput);
    fireEvent.submit(
      screen.getByRole("button", { name: "登録する" }).closest("form") as HTMLFormElement
    );

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledWith("/api/tags", {
        body: {
          name: "限定"
        }
      });
    });

    await screen.findByText("タグを登録しました。");
    expect(await screen.findByText("限定")).toBeInTheDocument();
  });

  it("maps duplicate-name errors to the form field without duplicating the message", async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        items: []
      }
    });
    apiClientMock.post.mockRejectedValue(
      new ApiClientError(400, {
        code: "DUPLICATE_NAME",
        details: [
          {
            field: "name",
            message: "同じ名前のタグは登録できません。"
          }
        ],
        message: "同じ名前は登録できません。"
      })
    );

    renderPage();

    await screen.findByRole("button", { name: "登録する" });

    const nameInput = screen.getByLabelText("タグ名");

    fireEvent.input(nameInput, {
      target: { value: "新作" }
    });
    fireEvent.blur(nameInput);
    fireEvent.submit(
      screen.getByRole("button", { name: "登録する" }).closest("form") as HTMLFormElement
    );

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledTimes(1);
    });
    expect(screen.getAllByText("同じ名前のタグは登録できません。")).toHaveLength(1);
  });

  it("loads the selected tag into the form and updates it", async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              isInUse: false,
              name: "新作",
              tagId: "tag_001",
              updatedAt: "2026-04-10T09:00:00.000Z",
              usedProductCount: 0
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              isInUse: false,
              name: "人気",
              tagId: "tag_001",
              updatedAt: "2026-04-12T09:00:00.000Z",
              usedProductCount: 0
            }
          ]
        }
      });
    apiClientMock.put.mockResolvedValue({
      data: {
        tagId: "tag_001"
      }
    });

    renderPage();

    const card = await screen.findByRole("listitem");

    fireEvent.click(within(card).getByRole("button", { name: "編集する" }));

    await waitFor(() => {
      expect(screen.getByLabelText("タグ名")).toHaveValue("新作");
    });

    const nameInput = screen.getByLabelText("タグ名");

    fireEvent.input(nameInput, {
      target: { value: "人気" }
    });
    fireEvent.blur(nameInput);
    fireEvent.submit(
      screen.getByRole("button", { name: "更新する" }).closest("form") as HTMLFormElement
    );

    await waitFor(() => {
      expect(apiClientMock.put).toHaveBeenCalledWith("/api/tags/tag_001", {
        body: {
          name: "人気"
        }
      });
    });

    expect(await screen.findByText("タグを更新しました。")).toBeInTheDocument();
    expect(await screen.findByText("人気")).toBeInTheDocument();
  });

  it("opens the delete confirmation dialog and deletes an unused tag", async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              isInUse: false,
              name: "新作",
              tagId: "tag_001",
              updatedAt: "2026-04-10T09:00:00.000Z",
              usedProductCount: 0
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: []
        }
      });
    apiClientMock.delete.mockResolvedValue({
      data: {
        tagId: "tag_001"
      }
    });

    renderPage();

    const card = await screen.findByRole("listitem");

    fireEvent.click(within(card).getByRole("button", { name: "削除する" }));

    const dialog = await screen.findByRole("dialog", {
      name: "タグ削除確認"
    });

    expect(
      within(dialog).getByText(/「新作」を削除しますか？/)
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(apiClientMock.delete).toHaveBeenCalledWith("/api/tags/tag_001");
    });

    expect(await screen.findByText("タグを削除しました。")).toBeInTheDocument();
    expect(
      await screen.findByText("タグはまだ登録されていません。最初のタグを登録してください。")
    ).toBeInTheDocument();
  });

  it("shows a retry action when the initial fetch fails", async () => {
    apiClientMock.get
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        data: {
          items: []
        }
      });

    renderPage();

    expect(await screen.findByText("タグ一覧を取得できませんでした。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await screen.findByText("タグはまだ登録されていません。最初のタグを登録してください。");
    expect(apiClientMock.get).toHaveBeenCalledTimes(2);
  });
});
