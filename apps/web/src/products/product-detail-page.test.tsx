import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getProductPath, getProductTasksPath } from "@handmade/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiClientError } from "../api/api-client";
import { createAppQueryClient } from "../api/query-client";
import { ProductDetailPage } from "./product-detail-page";

const apiClientMock = vi.hoisted(() => ({
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

const emptyTasksResponse = {
  data: {
    items: []
  }
};

let detailMode: "success" | "emptyImage" | "sold" | "error" | "notFound" =
  "success";
let taskMode: "success" | "empty" | "error" = "success";

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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProductDetailPage", () => {
  beforeEach(() => {
    detailMode = "success";
    taskMode = "success";
    apiClientMock.get.mockReset();
    qrCodeMock.toString.mockReset();
    qrCodeMock.toString.mockResolvedValue("<svg viewBox=\"0 0 10 10\"></svg>");

    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path === getProductTasksPath("HM-000001")) {
        if (taskMode === "error") {
          throw new Error("boom");
        }

        return taskMode === "empty" ? emptyTasksResponse : tasksResponse;
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
    expect(screen.getAllByText("HM-000001")).toHaveLength(3);
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

  it("shows empty states for missing image, tags, description, and tasks", async () => {
    detailMode = "emptyImage";
    taskMode = "empty";
    renderProductDetail();

    expect(await screen.findByText("画像は登録されていません")).toBeInTheDocument();
    expect(screen.getByText("タグなし")).toBeInTheDocument();
    expect(screen.getByText("説明はありません。")).toBeInTheDocument();
    expect(
      await screen.findByText("タスクはまだありません。必要な作業を追加してください。")
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
