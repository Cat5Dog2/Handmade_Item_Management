import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  getProductPath,
  getProductTasksPath,
  getTaskCompletionPath
} from "@handmade/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiClientError } from "../api/api-client";
import { createAppQueryClient } from "../api/query-client";
import { ProductDetailPage } from "./product-detail-page";

const apiClientMock = vi.hoisted(() => ({
  delete: vi.fn(),
  patch: vi.fn(),
  get: vi.fn()
}));

const qrCodeMock = vi.hoisted(() => ({
  toString: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

vi.mock("qrcode", () => ({
  toString: qrCodeMock.toString
}));

const productDetailResponse = {
  data: {
    images: [
      {
        displayUrl: "https://example.com/display-1.webp",
        imageId: "image-1",
        isPrimary: false,
        sortOrder: 2,
        thumbnailUrl: "https://example.com/thumb-1.webp",
        urlExpiresAt: "2026-04-25T12:00:00Z"
      },
      {
        displayUrl: "https://example.com/display-primary.webp",
        imageId: "image-2",
        isPrimary: true,
        sortOrder: 1,
        thumbnailUrl: "https://example.com/thumb-primary.webp",
        urlExpiresAt: "2026-04-25T12:00:00Z"
      }
    ],
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

const productWithoutImageResponse = {
  data: {
    ...productDetailResponse.data,
    images: [],
    product: {
      ...productDetailResponse.data.product,
      description: "",
      tagIds: [],
      tagNames: []
    }
  }
};

const soldProductDetailResponse = {
  data: {
    ...productDetailResponse.data,
    product: {
      ...productDetailResponse.data.product,
      soldAt: "2026-04-23T11:00:00Z",
      soldCustomerId: "cus_000001",
      soldCustomerNameSnapshot: "山田 花子",
      status: "sold" as const
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
        memo: "",
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

const tasksWithCompletedResponse = {
  data: {
    items: [
      ...tasksResponse.data.items,
      {
        completedAt: "2026-04-21T10:00:00Z",
        content: "撮影用の台紙を確認する",
        dueDate: null,
        isCompleted: true,
        memo: "",
        name: "台紙チェック",
        taskId: "task_003",
        updatedAt: "2026-04-21T10:00:00Z"
      }
    ]
  }
};

const emptyTasksResponse = {
  data: {
    items: []
  }
};

let detailMode: "success" | "emptyImage" | "sold" | "error" | "notFound" =
  "success";
let taskMode: "success" | "empty" | "error" = "success";
let printMock: ReturnType<typeof vi.fn>;

function renderProductDetail(initialEntry = "/products/HM-000001") {
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
          <Route path="/products/:productId" element={<ProductDetailPage />} />
          <Route path="/products" element={<div>商品一覧へ戻りました</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProductDetailPage", () => {
  beforeEach(() => {
    detailMode = "success";
    taskMode = "success";
    apiClientMock.delete.mockReset();
    apiClientMock.get.mockReset();
    apiClientMock.patch.mockReset();
    printMock = vi.fn();
    Object.defineProperty(window, "print", {
      configurable: true,
      value: printMock
    });
    qrCodeMock.toString.mockReset();
    qrCodeMock.toString.mockResolvedValue("<svg viewBox=\"0 0 10 10\"></svg>");
    apiClientMock.delete.mockResolvedValue({
      data: {
        deletedAt: "2026-04-24T10:00:00Z",
        productId: "HM-000001"
      }
    });
    apiClientMock.patch.mockResolvedValue({
      data: {
        completedAt: "2026-04-24T11:00:00Z",
        isCompleted: true,
        taskId: "task_001",
        updatedAt: "2026-04-24T11:00:00Z"
      }
    });

    apiClientMock.get.mockImplementation(async (path: string, options?: { query?: Record<string, unknown> }) => {
      if (path === getProductTasksPath("HM-000001")) {
        if (taskMode === "error") {
          throw new Error("boom");
        }

        if (taskMode === "empty") {
          return emptyTasksResponse;
        }

        return options?.query?.showCompleted ? tasksWithCompletedResponse : tasksResponse;
      }

      if (path !== getProductPath("HM-000001")) {
        throw new Error(`Unexpected path: ${path}`);
      }

      if (detailMode === "error") {
        throw new Error("boom");
      }

      if (detailMode === "notFound") {
        throw new ApiClientError(404, {
          code: "PRODUCT_NOT_FOUND",
          message: "not found"
        });
      }

      if (detailMode === "emptyImage") {
        return productWithoutImageResponse;
      }

      if (detailMode === "sold") {
        return soldProductDetailResponse;
      }

      return productDetailResponse;
    });
  });

  it("renders product detail, related tasks, and an SVG QR code from qrCodeValue", async () => {
    renderProductDetail();

    expect(await screen.findByRole("heading", { name: "Blue Ribbon" })).toBeInTheDocument();
    expect(apiClientMock.get).toHaveBeenCalledWith(
      getProductPath("HM-000001"),
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
    expect(screen.getAllByText("HM-000001").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("アクセサリー")).toBeInTheDocument();
    expect(screen.getByText("春, 一点もの")).toBeInTheDocument();
    expect(screen.getAllByText("2件").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByAltText("Blue Ribbon")).toHaveAttribute(
      "src",
      "https://example.com/display-primary.webp"
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
    expect(screen.getByText("値札を付ける")).toBeInTheDocument();

    await waitFor(() => {
      expect(qrCodeMock.toString).toHaveBeenCalledWith(
        "HM-000001",
        expect.objectContaining({
          type: "svg",
          width: 192
        })
      );
    });
    expect(await screen.findByTestId("product-qr-svg")).toContainHTML("<svg");
    expect(screen.getByRole("button", { name: "QRコードを印刷" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "編集する" })).toHaveAttribute(
      "href",
      "/products/HM-000001/edit"
    );
    expect(screen.getByRole("link", { name: "タスクを見る" })).toHaveAttribute(
      "href",
      "/products/HM-000001/tasks"
    );
    expect(screen.getByRole("link", { name: "タスク管理へ" })).toHaveAttribute(
      "href",
      "/products/HM-000001/tasks"
    );
    expect(screen.getByRole("link", { name: "QR読み取りへ" })).toHaveAttribute(
      "href",
      "/qr"
    );
  });

  it("prints the generated QR code from product detail", async () => {
    renderProductDetail();

    expect(await screen.findByTestId("product-qr-svg")).toBeInTheDocument();
    const printArea = screen.getByLabelText("HM-000001 の印刷用QRコード");
    expect(within(printArea).getByText("QRコード")).toBeInTheDocument();
    expect(within(printArea).getByText("Blue Ribbon")).toBeInTheDocument();
    expect(within(printArea).getAllByText("HM-000001")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "QRコードを印刷" }));

    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it("shows completed related tasks when the completed toggle is enabled", async () => {
    renderProductDetail();

    expect(await screen.findByText("金具チェック")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("完了済みも表示"));

    await waitFor(() => {
      expect(apiClientMock.get).toHaveBeenCalledWith(
        getProductTasksPath("HM-000001"),
        expect.objectContaining({
          query: {
            showCompleted: true
          },
          signal: expect.any(AbortSignal)
        })
      );
    });
    expect(await screen.findByText("台紙チェック")).toBeInTheDocument();
  });

  it("updates a related task completion state from product detail", async () => {
    renderProductDetail();

    expect(await screen.findByText("金具チェック")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("金具チェックを完了にする"));

    await waitFor(() => {
      expect(apiClientMock.patch).toHaveBeenCalledWith(
        getTaskCompletionPath("task_001"),
        {
          body: {
            isCompleted: true
          }
        }
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("金具チェック")).not.toBeInTheDocument();
    });
    expect(screen.getByText("未完了 1件")).toBeInTheDocument();
    expect(screen.getByText("完了 2件")).toBeInTheDocument();
  });

  it("deletes a product after confirmation and returns to the product list", async () => {
    renderProductDetail();

    expect(await screen.findByRole("heading", { name: "Blue Ribbon" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "削除する" })[0]);

    const dialog = screen.getByRole("dialog", { name: "商品を削除しますか？" });
    expect(
      within(dialog).getByText("削除した商品は通常画面から参照できなくなります。")
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(apiClientMock.delete).toHaveBeenCalledWith(
        getProductPath("HM-000001")
      );
    });
    expect(await screen.findByText("商品一覧へ戻りました")).toBeInTheDocument();
  });

  it("shows empty states for missing image, tags, description, and tasks", async () => {
    detailMode = "emptyImage";
    taskMode = "empty";
    renderProductDetail();

    expect(await screen.findByText("画像は登録されていません")).toBeInTheDocument();
    expect(screen.getByText("タグなし")).toBeInTheDocument();
    expect(screen.getByText("説明はありません。")).toBeInTheDocument();
    expect(
      await screen.findByText("未完了の関連タスクはありません。")
    ).toBeInTheDocument();
  });

  it("shows a customer detail link for sold products with a linked customer", async () => {
    detailMode = "sold";
    renderProductDetail();

    expect(await screen.findByRole("heading", { name: "Blue Ribbon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "山田 花子" })).toHaveAttribute(
      "href",
      "/customers/cus_000001"
    );
  });

  it("shows a retry action when related task loading fails", async () => {
    taskMode = "error";
    renderProductDetail();

    expect(await screen.findByRole("heading", { name: "Blue Ribbon" })).toBeInTheDocument();
    expect(
      await screen.findByText("タスク一覧を取得できませんでした。再度お試しください。")
    ).toBeInTheDocument();

    taskMode = "success";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByText("金具チェック")).toBeInTheDocument();
  });

  it("shows a retry action when product detail loading fails", async () => {
    detailMode = "error";
    renderProductDetail();

    expect(
      await screen.findByText("商品詳細の取得に失敗しました。再度お試しください。")
    ).toBeInTheDocument();

    detailMode = "success";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByRole("heading", { name: "Blue Ribbon" })).toBeInTheDocument();
  });

  it("shows the not found message when the product does not exist", async () => {
    detailMode = "notFound";
    renderProductDetail();

    expect(await screen.findByText("対象の商品が見つかりません。")).toBeInTheDocument();
  });
});
