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
import { CategoryManagementPage } from "./category-management-page";

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
      <CategoryManagementPage />
    </QueryClientProvider>
  );
}

describe("CategoryManagementPage", () => {
  beforeEach(() => {
    apiClientMock.delete.mockReset();
    apiClientMock.get.mockReset();
    apiClientMock.patch.mockReset();
    apiClientMock.post.mockReset();
    apiClientMock.put.mockReset();
    apiClientMock.request.mockReset();
  });

  it("renders the category list and keeps delete disabled for in-use items", async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        items: [
          {
            categoryId: "cat_001",
            isInUse: true,
            name: "ピアス",
            sortOrder: 10,
            updatedAt: "2026-04-10T09:00:00.000Z",
            usedProductCount: 2
          },
          {
            categoryId: "cat_002",
            isInUse: false,
            name: "イヤリング",
            sortOrder: 20,
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
    ).toEqual(["ピアス", "イヤリング"]);
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

  it("creates a category and refreshes the list", async () => {
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
              categoryId: "cat_010",
              isInUse: false,
              name: "ブローチ",
              sortOrder: 30,
              updatedAt: "2026-04-12T09:00:00.000Z",
              usedProductCount: 0
            }
          ]
        }
      });
    apiClientMock.post.mockResolvedValue({
      data: {
        categoryId: "cat_010"
      }
    });

    renderPage();

    await screen.findByText(
      "カテゴリはまだ登録されていません。最初のカテゴリを登録してください。"
    );

    const nameInput = screen.getByLabelText("カテゴリ名");

    fireEvent.input(nameInput, {
      target: { value: "ブローチ" }
    });
    fireEvent.blur(nameInput);
    fireEvent.submit(
      screen.getByRole("button", { name: "登録する" }).closest("form") as HTMLFormElement
    );

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledWith("/api/categories", {
        body: {
          name: "ブローチ",
          sortOrder: null
        }
      });
    });

    await screen.findByText("カテゴリを登録しました。");
    expect(await screen.findByText("ブローチ")).toBeInTheDocument();
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
            message: "同じ名前のカテゴリは登録できません。"
          }
        ],
        message: "同じ名前は登録できません。"
      })
    );

    renderPage();

    await screen.findByRole("button", { name: "登録する" });

    const nameInput = screen.getByLabelText("カテゴリ名");

    fireEvent.input(nameInput, {
      target: { value: "ピアス" }
    });
    fireEvent.blur(nameInput);
    fireEvent.submit(
      screen.getByRole("button", { name: "登録する" }).closest("form") as HTMLFormElement
    );

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getAllByText("同じ名前のカテゴリは登録できません。")
    ).toHaveLength(1);
  });

  it("loads the selected category into the form and updates it", async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              categoryId: "cat_001",
              isInUse: false,
              name: "ピアス",
              sortOrder: 10,
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
              categoryId: "cat_001",
              isInUse: false,
              name: "イヤリング",
              sortOrder: 15,
              updatedAt: "2026-04-12T09:00:00.000Z",
              usedProductCount: 0
            }
          ]
        }
      });
    apiClientMock.put.mockResolvedValue({
      data: {
        categoryId: "cat_001"
      }
    });

    renderPage();

    const card = await screen.findByRole("listitem");

    fireEvent.click(within(card).getByRole("button", { name: "編集する" }));

    await waitFor(() => {
      expect(screen.getByLabelText("カテゴリ名")).toHaveValue("ピアス");
      expect(screen.getByLabelText("表示順")).toHaveValue(10);
    });

    const nameInput = screen.getByLabelText("カテゴリ名");
    const sortOrderInput = screen.getByLabelText("表示順");

    fireEvent.input(nameInput, {
      target: { value: "イヤリング" }
    });
    fireEvent.blur(nameInput);
    fireEvent.input(sortOrderInput, {
      target: { value: "15" }
    });
    fireEvent.blur(sortOrderInput);
    fireEvent.submit(
      screen.getByRole("button", { name: "更新する" }).closest("form") as HTMLFormElement
    );

    await waitFor(() => {
      expect(apiClientMock.put).toHaveBeenCalledWith("/api/categories/cat_001", {
        body: {
          name: "イヤリング",
          sortOrder: 15
        }
      });
    });

    expect(await screen.findByText("カテゴリを更新しました。")).toBeInTheDocument();
    expect(await screen.findByText("イヤリング")).toBeInTheDocument();
  });

  it("opens the delete confirmation dialog and deletes an unused category", async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              categoryId: "cat_001",
              isInUse: false,
              name: "ピアス",
              sortOrder: 10,
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
        categoryId: "cat_001"
      }
    });

    renderPage();

    const card = await screen.findByRole("listitem");

    fireEvent.click(within(card).getByRole("button", { name: "削除する" }));

    const dialog = await screen.findByRole("dialog", {
      name: "カテゴリ削除確認"
    });

    expect(
      within(dialog).getByText(/「ピアス」を削除しますか？/)
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(apiClientMock.delete).toHaveBeenCalledWith(
        "/api/categories/cat_001"
      );
    });

    expect(await screen.findByText("カテゴリを削除しました。")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "カテゴリはまだ登録されていません。最初のカテゴリを登録してください。"
      )
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

    expect(
      await screen.findByText("カテゴリ一覧を取得できませんでした。")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await screen.findByText(
      "カテゴリはまだ登録されていません。最初のカテゴリを登録してください。"
    );
    expect(apiClientMock.get).toHaveBeenCalledTimes(2);
  });
});
