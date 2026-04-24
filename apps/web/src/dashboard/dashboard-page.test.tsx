import type { DashboardResponseData } from "@handmade/shared";
import { API_PATHS } from "@handmade/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../api/query-client";
import { DashboardPage } from "./dashboard-page";

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

const dashboardData: DashboardResponseData = {
  statusCounts: {
    beforeProduction: 1,
    completed: 3,
    inProduction: 2,
    inStock: 5,
    onDisplay: 4,
    sold: 6
  },
  soldCount: 6,
  openTaskCount: 8,
  dueSoonTasks: [
    {
      dueDate: "2026-04-25",
      productId: "HM-000001",
      productName: "春色ピアス",
      taskId: "task_001",
      taskName: "台紙を準備する"
    }
  ],
  recentProducts: [
    {
      name: "青のブローチ",
      productId: "HM-000010",
      status: "onDisplay",
      thumbnailUrl: "https://example.com/thumb.webp",
      updatedAt: "2026-04-20T08:30:00Z"
    }
  ]
};

const emptyDashboardData: DashboardResponseData = {
  statusCounts: {
    beforeProduction: 0,
    completed: 0,
    inProduction: 0,
    inStock: 0,
    onDisplay: 0,
    sold: 0
  },
  soldCount: 0,
  openTaskCount: 0,
  dueSoonTasks: [],
  recentProducts: []
};

let dashboardMode: "empty" | "error" | "success" = "success";

function renderDashboard() {
  const queryClient = createAppQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    dashboardMode = "success";
    apiClientMock.get.mockReset();
    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path !== API_PATHS.dashboard) {
        throw new Error(`Unexpected path: ${path}`);
      }

      if (dashboardMode === "error") {
        throw new Error("boom");
      }

      return {
        data: dashboardMode === "empty" ? emptyDashboardData : dashboardData
      };
    });
  });

  it("renders dashboard counts, due soon tasks, and recent products", async () => {
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "件数" }, { timeout: 8000 })
    ).toBeInTheDocument();

    expect(apiClientMock.get).toHaveBeenCalledWith(
      API_PATHS.dashboard,
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
    expect(screen.getByText("制作前")).toBeInTheDocument();
    expect(screen.getByText("販売済件数")).toBeInTheDocument();
    expect(screen.getByText("未完了タスク件数")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();

    const taskLink = screen.getByRole("link", {
      name: "台紙を準備するのタスク管理へ"
    });
    expect(taskLink).toHaveAttribute("href", "/products/HM-000001/tasks");
    expect(screen.getByText("2026/04/25")).toBeInTheDocument();

    const productLink = screen.getByRole("link", {
      name: "青のブローチの商品詳細へ"
    });
    expect(productLink).toHaveAttribute("href", "/products/HM-000010");
    expect(screen.getByRole("img", { name: "青のブローチ" })).toHaveAttribute(
      "src",
      "https://example.com/thumb.webp"
    );
  });

  it("keeps zero count cards visible and shows empty list messages", async () => {
    dashboardMode = "empty";
    renderDashboard();

    expect(
      await screen.findByText("期限が近いタスクはありません。", undefined, {
        timeout: 8000
      })
    ).toBeInTheDocument();
    expect(screen.getByText("最近更新した商品はありません。")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(8);
  });

  it("shows a retry action when dashboard loading fails", async () => {
    dashboardMode = "error";
    renderDashboard();

    expect(
      await screen.findByRole("alert", undefined, { timeout: 8000 })
    ).toHaveTextContent("ダッシュボードの取得に失敗しました。");

    dashboardMode = "success";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await waitFor(() => {
      expect(screen.getByText("台紙を準備する")).toBeInTheDocument();
    });
  });
});
