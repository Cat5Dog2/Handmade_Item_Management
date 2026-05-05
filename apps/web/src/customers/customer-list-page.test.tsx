import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { API_PATHS } from "@handmade/shared";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../api/query-client";
import { CustomerListPage } from "./customer-list-page";

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

const purchasedCustomer = {
  ageGroup: null,
  customerId: "cus_000001",
  customerStyle: null,
  gender: null,
  lastPurchaseAt: "2026-04-20T08:30:00Z",
  lastPurchaseProductId: "HM-000010",
  lastPurchaseProductName: "Blue Ribbon",
  name: "Hanako Aoki",
  purchaseCount: 2,
  updatedAt: "2026-04-18T00:00:00Z"
};

const newCustomer = {
  ageGroup: null,
  customerId: "cus_000002",
  customerStyle: null,
  gender: null,
  lastPurchaseAt: null,
  lastPurchaseProductId: null,
  lastPurchaseProductName: null,
  name: "Sora Sato",
  purchaseCount: 0,
  updatedAt: "2026-04-17T00:00:00Z"
};

let customersMode: "success" | "error" = "success";

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location-probe">{location.search}</div>;
}

function renderCustomerList(initialEntry = "/customers") {
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
        <CustomerListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function getLatestCustomerCall() {
  const customerCalls = apiClientMock.get.mock.calls.filter(
    ([path]) => path === API_PATHS.customers
  );

  return customerCalls[customerCalls.length - 1];
}

describe("CustomerListPage", () => {
  beforeEach(() => {
    customersMode = "success";
    apiClientMock.get.mockReset();
    apiClientMock.get.mockImplementation(async (path: string, options?: { query?: Record<string, unknown> }) => {
      if (path !== API_PATHS.customers) {
        throw new Error(`Unexpected path: ${path}`);
      }

      if (customersMode === "error") {
        throw new Error("boom");
      }

      const page = Number(options?.query?.page ?? 1);
      const pageSize = Number(options?.query?.pageSize ?? 50);
      const keyword = String(options?.query?.keyword ?? "");

      if (keyword === "no-match") {
        return {
          data: {
            items: []
          },
          meta: {
            hasNext: false,
            page,
            pageSize,
            totalCount: 0
          }
        };
      }

      if (page === 2) {
        return {
          data: {
            items: [newCustomer]
          },
          meta: {
            hasNext: false,
            page,
            pageSize,
            totalCount: 2
          }
        };
      }

      return {
        data: {
          items: [purchasedCustomer]
        },
        meta: {
          hasNext: true,
          page,
          pageSize,
          totalCount: 2
        }
      };
    });
  }, 10000);

  it("renders the current query state and customer cards", async () => {
    renderCustomerList(
      "/customers?keyword=hanako&sortBy=name&sortOrder=asc"
    );

    await screen.findByRole("listitem", undefined, { timeout: 8000 });

    expect(screen.getByLabelText("キーワード")).toHaveValue("hanako");
    expect(screen.getByLabelText("並び順")).toHaveValue("name");
    expect(screen.getByLabelText("並び順序")).toHaveValue("asc");

    const customerCard = screen.getByRole("listitem");
    expect(customerCard).toHaveAttribute("href", "/customers/cus_000001");
    expect(screen.getByRole("link", { name: "顧客登録" })).toHaveAttribute(
      "href",
      "/customers/new"
    );
    expect(screen.getByText("2件")).toBeInTheDocument();

    const customerCall = getLatestCustomerCall();
    expect(customerCall).toBeDefined();
    expect(customerCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          keyword: "hanako",
          sortBy: "name",
          sortOrder: "asc"
        })
      })
    );
  }, 10000);

  it("applies filters through the URL", async () => {
    renderCustomerList("/customers");

    await screen.findByLabelText("キーワード", undefined, { timeout: 8000 });

    fireEvent.change(screen.getByLabelText("キーワード"), {
      target: { value: "memo search" }
    });
    fireEvent.change(screen.getByLabelText("並び順"), {
      target: { value: "lastPurchaseAt" }
    });

    fireEvent.click(screen.getByRole("button", { name: "絞り込む" }));

    await waitFor(() => {
      const locationSearch = screen.getByTestId("location-probe").textContent ?? "";
      const searchParams = new URLSearchParams(locationSearch);

      expect(searchParams.get("keyword")).toBe("memo search");
      expect(searchParams.get("sortBy")).toBe("lastPurchaseAt");
      expect(searchParams.get("page")).toBeNull();
    });

    const customerCall = getLatestCustomerCall();
    expect(customerCall).toBeDefined();
    expect(customerCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          keyword: "memo search",
          page: 1,
          sortBy: "lastPurchaseAt"
        })
      })
    );
  }, 10000);

  it("shows a validation notice without applying invalid search keywords", async () => {
    renderCustomerList("/customers");

    const keywordInput = await screen.findByRole("searchbox", undefined, {
      timeout: 8000
    });

    fireEvent.change(keywordInput, {
      target: { value: "a".repeat(101) }
    });
    fireEvent.submit(keywordInput.closest("form") as HTMLFormElement);

    expect(
      await screen.findByText("検索条件を確認してください。", undefined, {
        timeout: 8000
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent).toBe("");
    });
  }, 10000);

  it("shows a validation notice when URL query values are invalid", async () => {
    renderCustomerList(`/customers?keyword=${"a".repeat(101)}`);

    expect(
      await screen.findByText("検索条件を確認してください。", undefined, {
        timeout: 8000
      })
    ).toBeInTheDocument();

    const customerCall = getLatestCustomerCall();
    expect(customerCall).toBeDefined();
    expect(customerCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          page: 1,
          pageSize: 50
        })
      })
    );
  }, 10000);

  it("moves between pages with the pagination controls", async () => {
    renderCustomerList("/customers?pageSize=1");

    await screen.findByRole("listitem", undefined, { timeout: 8000 });

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    await waitFor(() => {
      const locationSearch = screen.getByTestId("location-probe").textContent ?? "";
      const searchParams = new URLSearchParams(locationSearch);

      expect(searchParams.get("page")).toBe("2");
      expect(searchParams.get("pageSize")).toBe("1");
    });

    await screen.findByText("Sora Sato", undefined, { timeout: 8000 });
    expect(screen.getByText("購入なし")).toBeInTheDocument();
    expect(screen.getByText("購入商品なし")).toBeInTheDocument();

    const customerCall = getLatestCustomerCall();
    expect(customerCall).toBeDefined();
    expect(customerCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          page: 2,
          pageSize: 1
        })
      })
    );
  }, 10000);

  it("shows an empty state and clears filters back to the default view", async () => {
    renderCustomerList("/customers?keyword=no-match");

    expect(
      await screen.findByText("条件に一致する顧客はありません。", undefined, {
        timeout: 8000
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "条件をクリア" })[1]);

    await waitFor(() => {
      const locationSearch = screen.getByTestId("location-probe").textContent ?? "";
      const searchParams = new URLSearchParams(locationSearch);

      expect(searchParams.get("keyword")).toBeNull();
      expect(searchParams.get("sortBy")).toBeNull();
    });

    await screen.findByRole("listitem", undefined, { timeout: 8000 });
  }, 10000);

  it("shows a retry action when customer loading fails", async () => {
    customersMode = "error";
    renderCustomerList("/customers");

    expect(
      await screen.findByRole("alert", undefined, { timeout: 8000 })
    ).toBeInTheDocument();

    customersMode = "success";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await screen.findByRole("listitem", undefined, { timeout: 8000 });
  }, 10000);
});
