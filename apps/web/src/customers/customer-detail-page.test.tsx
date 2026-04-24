import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiClientError } from "../api/api-client";
import { CustomerDetailPage } from "./customer-detail-page";
import { CustomerListPage } from "./customer-list-page";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createAppQueryClient } from "../api/query-client";

const apiClientMock = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

const activeCustomerDetailResponse = {
  data: {
    customer: {
      archivedAt: null,
      ageGroup: "30代",
      createdAt: "2026-03-17T10:00:00Z",
      customerId: "cus_000001",
      customerStyle: "ナチュラル系",
      gender: "女性",
      isArchived: false,
      memo: "春色アクセサリーをよく購入する",
      name: "山田 花子",
      snsAccounts: [
        {
          accountName: "@hanako",
          note: "DMで連絡",
          platform: "Instagram",
          url: "https://example.com/hanako"
        }
      ],
      updatedAt: "2026-03-20T08:30:00Z"
    },
    summary: {
      lastPurchaseAt: "2026-03-20T08:30:00Z",
      lastPurchaseProductId: "HM-000010",
      lastPurchaseProductName: "青のブローチ",
      purchaseCount: 3
    }
  }
};

const archivedCustomerDetailResponse = {
  data: {
    customer: {
      archivedAt: "2026-04-22T06:00:00Z",
      ageGroup: null,
      createdAt: "2026-03-17T10:00:00Z",
      customerId: "cus_000002",
      customerStyle: null,
      gender: null,
      isArchived: true,
      memo: null,
      name: "佐藤 空",
      snsAccounts: [],
      updatedAt: "2026-04-22T06:00:00Z"
    },
    summary: {
      lastPurchaseAt: null,
      lastPurchaseProductId: null,
      lastPurchaseProductName: null,
      purchaseCount: 0
    }
  }
};

const purchasesResponse = {
  data: {
    items: [
      {
        name: "青のブローチ",
        price: 2800,
        productId: "HM-000010",
        soldAt: "2026-03-20T08:30:00Z"
      },
      {
        name: "白いピアス",
        price: 3200,
        productId: "HM-000008",
        soldAt: "2026-03-18T06:15:00Z"
      }
    ]
  }
};

const emptyPurchasesResponse = {
  data: {
    items: []
  }
};

let detailMode: "active" | "archived" | "error" | "notFound" = "active";
let purchasesMode: "filled" | "empty" | "error" = "filled";

function LocationProbe() {
  const location = useLocation();
  const state =
    typeof location.state === "object" && location.state !== null
      ? JSON.stringify(location.state)
      : "";

  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
      {state}
    </div>
  );
}

function renderCustomerDetail(initialEntry = "/customers/cus_000001") {
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
        <LocationProbe />
        <Routes>
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CustomerDetailPage", () => {
  beforeEach(() => {
    detailMode = "active";
    purchasesMode = "filled";
    apiClientMock.get.mockReset();
    apiClientMock.delete.mockReset();

    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path === "/customers/cus_000001" || path === "/customers/cus_000002") {
        if (detailMode === "error") {
          throw new Error("boom");
        }

        if (detailMode === "notFound") {
          throw new ApiClientError(404, {
            code: "CUSTOMER_NOT_FOUND",
            message: "対象の顧客が見つかりません。"
          });
        }

        return detailMode === "archived"
          ? archivedCustomerDetailResponse
          : activeCustomerDetailResponse;
      }

      if (path === "/customers/cus_000001/purchases" || path === "/customers/cus_000002/purchases") {
        if (purchasesMode === "error") {
          throw new Error("boom");
        }

        return purchasesMode === "empty"
          ? emptyPurchasesResponse
          : purchasesResponse;
      }

      if (path === "/customers") {
        return {
          data: {
            items: []
          },
          meta: {
            hasNext: false,
            page: 1,
            pageSize: 50,
            totalCount: 0
          }
        };
      }

      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("renders customer basic information, purchase summary, and purchase history", async () => {
    renderCustomerDetail();

    expect(await screen.findByRole("heading", { name: "山田 花子" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "編集する" })).toHaveAttribute(
      "href",
      "/customers/cus_000001/edit"
    );
    expect(screen.getByRole("button", { name: "アーカイブ" })).toBeEnabled();
    expect(screen.getByText("Instagram: @hanako")).toBeInTheDocument();
    expect(screen.getByText("春色アクセサリーをよく購入する")).toBeInTheDocument();
    expect(screen.getByText("青のブローチ (HM-000010)")).toBeInTheDocument();
    expect(screen.getByText("3件")).toBeInTheDocument();

    const purchaseLink = screen.getByRole("listitem", { name: "青のブローチ" });
    expect(purchaseLink).toHaveAttribute("href", "/products/HM-000010");
  });

  it("shows archived customers as read-only and keeps purchase history visible", async () => {
    detailMode = "archived";
    purchasesMode = "empty";

    renderCustomerDetail("/customers/cus_000002");

    expect(await screen.findByRole("heading", { name: "佐藤 空" })).toBeInTheDocument();
    expect(
      screen.getByText("この顧客はアーカイブ済みです。購入履歴の参照のみ可能です。")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "編集する" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "アーカイブ済み" })).toBeDisabled();
    expect(screen.getByText("購入履歴はありません。")).toBeInTheDocument();
  });

  it("opens the archive dialog and navigates back to the customer list after archiving", async () => {
    apiClientMock.delete.mockResolvedValue({
      data: {
        archivedAt: "2026-04-22T06:00:00Z",
        customerId: "cus_000001",
        updatedAt: "2026-04-22T06:00:00Z"
      }
    });

    renderCustomerDetail();

    await screen.findByRole("heading", { name: "山田 花子" });

    fireEvent.click(screen.getByRole("button", { name: "アーカイブ" }));

    const dialog = await screen.findByRole("dialog", {
      name: "顧客をアーカイブしますか？"
    });

    expect(
      within(dialog).getByText(/アーカイブした顧客は通常一覧に表示されなくなります。/)
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "アーカイブ" }));

    await waitFor(() => {
      expect(apiClientMock.delete).toHaveBeenCalledWith("/customers/cus_000001");
    });

    expect(await screen.findByText("顧客をアーカイブしました。")).toBeInTheDocument();
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/customers");
  });

  it("shows a retry action when loading customer detail fails", async () => {
    detailMode = "error";
    renderCustomerDetail();

    expect(
      await screen.findByText("顧客情報を取得できませんでした。")
    ).toBeInTheDocument();

    detailMode = "active";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await screen.findByRole("heading", { name: "山田 花子" });
  });

  it("shows the not found message when the customer does not exist", async () => {
    detailMode = "notFound";
    renderCustomerDetail();

    expect(
      await screen.findByText("対象の顧客が見つかりません。")
    ).toBeInTheDocument();
  });
});
