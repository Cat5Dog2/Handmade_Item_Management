import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getProductPath, getProductTasksPath, getTaskPath } from "@handmade/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiClientError } from "../api/api-client";
import { createAppQueryClient } from "../api/query-client";
import { ProductTaskManagementPage } from "./product-task-management-page";

const apiClientMock = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

const productDetailResponse = {
  data: {
    images: [],
    product: {
      categoryId: "cat-1",
      categoryName: "アクセサリー",
      createdAt: "2026-04-20T08:00:00Z",
      description: "春色のリボンです。",
      name: "Blue Ribbon",
      price: 2800,
      productId: "HM-000001",
      soldAt: null,
      soldCustomerId: null,
      soldCustomerNameSnapshot: null,
      status: "onDisplay" as const,
      tagIds: ["tag-1", "tag-2"],
      tagNames: ["春", "一点もの"],
      updatedAt: "2026-04-22T10:30:00Z"
    },
    qrCodeValue: "HM-000001",
    tasksSummary: {
      completedCount: 1,
      openCount: 2
    }
  }
};

const tasksResponse = {
  data: {
    items: [
      {
        completedAt: null,
        content: "イベント前に金具を確認する",
        dueDate: "2026-04-30",
        isCompleted: false,
        memo: "予備パーツも見る",
        name: "金具チェック",
        taskId: "task_001",
        updatedAt: "2026-04-23T09:00:00Z"
      },
      {
        completedAt: null,
        content: "",
        dueDate: null,
        isCompleted: false,
        memo: "",
        name: "値札を付ける",
        taskId: "task_002",
        updatedAt: "2026-04-22T09:00:00Z"
      }
    ]
  }
};

const emptyTasksResponse = {
  data: {
    items: []
  }
};

let productMode: "success" | "notFound" = "success";
let taskMode: "success" | "empty" | "error" = "success";

function renderTaskManagement(initialEntry = "/products/HM-000001/tasks") {
  const queryClient = createAppQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={[initialEntry]}
      >
        <Routes>
          <Route
            path="/products/:productId/tasks"
            element={<ProductTaskManagementPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProductTaskManagementPage", () => {
  beforeEach(() => {
    productMode = "success";
    taskMode = "success";
    apiClientMock.delete.mockReset();
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
    apiClientMock.put.mockReset();
    apiClientMock.delete.mockResolvedValue({
      data: {
        taskId: "task_001"
      }
    });
    apiClientMock.post.mockResolvedValue({
      data: {
        taskId: "task_003",
        updatedAt: "2026-04-24T10:00:00Z"
      }
    });
    apiClientMock.put.mockResolvedValue({
      data: {
        completedAt: null,
        taskId: "task_001"
      }
    });

    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path === getProductPath("HM-000001")) {
        if (productMode === "notFound") {
          throw new ApiClientError(404, {
            code: "PRODUCT_NOT_FOUND",
            message: "not found"
          });
        }

        return productDetailResponse;
      }

      if (path === getProductTasksPath("HM-000001")) {
        if (taskMode === "error") {
          throw new Error("boom");
        }

        return taskMode === "empty" ? emptyTasksResponse : tasksResponse;
      }

      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("renders target product context and open tasks", async () => {
    renderTaskManagement();

    expect(
      await screen.findByRole("heading", { name: "Blue Ribbonのタスク管理" })
    ).toBeInTheDocument();
    expect(screen.getByText("HM-000001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品詳細へ" })).toHaveAttribute(
      "href",
      "/products/HM-000001"
    );

    await waitFor(() => {
      expect(apiClientMock.get).toHaveBeenCalledWith(
        getProductTasksPath("HM-000001"),
        expect.objectContaining({
          query: {
            showCompleted: false
          },
          signal: expect.any(AbortSignal)
        })
      );
    });
    expect(await screen.findByText("金具チェック")).toBeInTheDocument();
    expect(screen.getByText("イベント前に金具を確認する")).toBeInTheDocument();
    expect(screen.getByText("予備パーツも見る")).toBeInTheDocument();
    expect(screen.getByText("値札を付ける")).toBeInTheDocument();
    expect(screen.getByText("未完了 2件")).toBeInTheDocument();
    expect(screen.getByText("完了 1件")).toBeInTheDocument();
  });

  it("creates a task from the task form", async () => {
    renderTaskManagement();

    expect(await screen.findByText("金具チェック")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "タスクを追加" }));
    fireEvent.change(screen.getByLabelText("タスク名"), {
      target: { value: "ラッピング準備" }
    });
    fireEvent.change(screen.getByLabelText("納期"), {
      target: { value: "2026-05-01" }
    });
    fireEvent.change(screen.getByLabelText("タスク内容"), {
      target: { value: "イベント用に包装紙を準備する" }
    });
    fireEvent.change(screen.getByLabelText("メモ"), {
      target: { value: "在庫数も確認する" }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "追加する" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledWith(
        getProductTasksPath("HM-000001"),
        {
          body: {
            content: "イベント用に包装紙を準備する",
            dueDate: "2026-05-01",
            memo: "在庫数も確認する",
            name: "ラッピング準備"
          }
        }
      );
    });
    expect(await screen.findByText("タスクを追加しました。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "タスク追加" })).not.toBeInTheDocument();
  });

  it("updates a task while preserving its completion state", async () => {
    renderTaskManagement();

    expect(await screen.findByText("金具チェック")).toBeInTheDocument();

    const taskCard = screen.getByText("金具チェック").closest("article");
    expect(taskCard).not.toBeNull();
    fireEvent.click(
      within(taskCard as HTMLElement).getByRole("button", { name: "編集する" })
    );

    expect(screen.getByRole("heading", { name: "タスク編集" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("タスク名"), {
      target: { value: "金具チェック更新" }
    });
    fireEvent.change(screen.getByLabelText("メモ"), {
      target: { value: "交換パーツも確認する" }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "更新する" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(apiClientMock.put).toHaveBeenCalledWith(getTaskPath("task_001"), {
        body: {
          content: "イベント前に金具を確認する",
          dueDate: "2026-04-30",
          isCompleted: false,
          memo: "交換パーツも確認する",
          name: "金具チェック更新"
        }
      });
    });
    expect(await screen.findByText("タスクを更新しました。")).toBeInTheDocument();
  });

  it("deletes a task after confirmation", async () => {
    renderTaskManagement();

    expect(await screen.findByText("金具チェック")).toBeInTheDocument();

    const taskCard = screen.getByText("金具チェック").closest("article");
    expect(taskCard).not.toBeNull();
    fireEvent.click(
      within(taskCard as HTMLElement).getByRole("button", { name: "削除する" })
    );

    const dialog = screen.getByRole("dialog", { name: "タスク削除確認" });
    expect(
      within(dialog).getByText(/削除したタスクは元に戻せません。/)
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(apiClientMock.delete).toHaveBeenCalledWith(getTaskPath("task_001"));
    });
    expect(await screen.findByText("タスクを削除しました。")).toBeInTheDocument();
  });

  it("shows a field error when the task name is empty", async () => {
    renderTaskManagement();

    expect(await screen.findByText("金具チェック")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "タスクを追加" }));
    fireEvent.change(screen.getByLabelText("タスク名"), {
      target: { value: "   " }
    });

    expect(await screen.findByText("タスク名を入力してください。")).toBeInTheDocument();
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("shows the empty state when there are no open tasks", async () => {
    taskMode = "empty";
    renderTaskManagement();

    expect(
      await screen.findByText("未完了のタスクはありません。")
    ).toBeInTheDocument();
  });

  it("shows a retry action when task loading fails", async () => {
    taskMode = "error";
    renderTaskManagement();

    expect(
      await screen.findByText("タスク一覧を取得できませんでした。再度お試しください。")
    ).toBeInTheDocument();

    taskMode = "success";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByText("金具チェック")).toBeInTheDocument();
  });

  it("shows the not found message when the product does not exist", async () => {
    productMode = "notFound";
    renderTaskManagement();

    expect(await screen.findByText("対象の商品が見つかりません。")).toBeInTheDocument();
  });
});
