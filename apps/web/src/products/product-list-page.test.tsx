import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLocation, MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_PATHS } from "@handmade/shared";
import { createAppQueryClient } from "../api/query-client";
import { ProductListPage } from "./product-list-page";

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

const categoriesResponse = {
  data: {
    items: [
      {
        categoryId: "cat-1",
        isInUse: false,
        name: "アクセサリー",
        sortOrder: 1,
        updatedAt: "2026-04-18T00:00:00Z",
        usedProductCount: 0
      }
    ]
  }
};

const tagsResponse = {
  data: {
    items: [
      {
        isInUse: false,
        name: "春",
        tagId: "tag-1",
        updatedAt: "2026-04-18T00:00:00Z",
        usedProductCount: 0
      }
    ]
  }
};

const displayProduct = {
  categoryName: "アクセサリー",
  name: "Blue Ribbon",
  productId: "HM-000001",
  status: "onDisplay" as const,
  thumbnailUrl: "https://example.com/thumb-1.webp",
  updatedAt: "2026-04-18T00:00:00Z"
};

const soldProduct = {
  categoryName: "アクセサリー",
  name: "Sold Ribbon",
  productId: "HM-000002",
  status: "sold" as const,
  thumbnailUrl: null,
  updatedAt: "2026-04-17T00:00:00Z"
};

let productsMode: "success" | "error" = "success";

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location-probe">{location.search}</div>;
}

function renderProductList(
  initialEntry: string | { pathname: string; state: unknown } = "/products"
) {
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
        <ProductListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function getLatestProductCall() {
  const productCalls = apiClientMock.get.mock.calls.filter(
    ([path]) => path === API_PATHS.products
  );

  return productCalls[productCalls.length - 1];
}

describe("ProductListPage", () => {
  beforeEach(() => {
    productsMode = "success";
    apiClientMock.get.mockReset();
    apiClientMock.get.mockImplementation(async (path: string, options?: { query?: Record<string, unknown> }) => {
      if (path === API_PATHS.categories) {
        return categoriesResponse;
      }

      if (path === API_PATHS.tags) {
        return tagsResponse;
      }

      if (path === API_PATHS.products) {
        if (productsMode === "error") {
          throw new Error("boom");
        }

        const page = Number(options?.query?.page ?? 1);
        const pageSize = Number(options?.query?.pageSize ?? 50);
        const keyword = String(options?.query?.keyword ?? "");
        const status = String(options?.query?.status ?? "");

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
              items: [soldProduct]
            },
            meta: {
              hasNext: false,
              page,
              pageSize,
              totalCount: 2
            }
          };
        }

        if (status === "sold") {
          return {
            data: {
              items: [soldProduct]
            },
            meta: {
              hasNext: false,
              page,
              pageSize,
              totalCount: 1
            }
          };
        }

        return {
          data: {
            items: [displayProduct]
          },
          meta: {
            hasNext: true,
            page,
            pageSize,
            totalCount: 2
          }
        };
      }

      throw new Error(`Unexpected path: ${path}`);
    });
  }, 10000);

  it("renders the current query state and product cards", async () => {
    renderProductList(
      "/products?keyword=blue&status=onDisplay&sortBy=name&sortOrder=asc"
    );

    await screen.findByRole("listitem", undefined, { timeout: 8000 });

    expect(screen.getByLabelText("キーワード")).toHaveValue("blue");
    expect(screen.getByLabelText("ステータス")).toHaveValue("onDisplay");
    expect(screen.getByLabelText("販売済みを含める")).toBeChecked();

    const productCard = screen.getByRole("listitem");
    expect(productCard).toHaveAttribute("href", "/products/HM-000001");
    expect(screen.getByRole("link", { name: "商品登録" })).toHaveAttribute(
      "href",
      "/products/new"
    );

    const productCall = getLatestProductCall();
    expect(productCall).toBeDefined();
    expect(productCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          keyword: "blue",
          sortBy: "name",
          sortOrder: "asc",
          status: "onDisplay"
        })
      })
    );
  }, 10000);

  it("shows a navigation notice from product detail", async () => {
    renderProductList({
      pathname: "/products",
      state: {
        notice: {
          message: "商品を削除しました。",
          type: "success"
        }
      }
    });

    expect(
      await screen.findByText("商品を削除しました。", undefined, { timeout: 8000 })
    ).toBeInTheDocument();
  }, 10000);

  it("applies filters through the URL and keeps sold results enabled", async () => {
    renderProductList("/products");

    await screen.findByLabelText("キーワード", undefined, { timeout: 8000 });

    fireEvent.change(screen.getByLabelText("キーワード"), {
      target: { value: "gold" }
    });
    fireEvent.change(screen.getByLabelText("ステータス"), {
      target: { value: "sold" }
    });

    expect(screen.getByLabelText("販売済みを含める")).toBeChecked();
    expect(screen.getByLabelText("販売済みを含める")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "絞り込む" }));

    await waitFor(() => {
      const locationSearch = screen.getByTestId("location-probe").textContent ?? "";
      const searchParams = new URLSearchParams(locationSearch);

      expect(searchParams.get("keyword")).toBe("gold");
      expect(searchParams.get("status")).toBe("sold");
      expect(searchParams.get("includeSold")).toBe("true");
    });

    const productCall = getLatestProductCall();
    expect(productCall).toBeDefined();
    expect(productCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          includeSold: true,
          keyword: "gold",
          page: 1,
          status: "sold"
        })
      })
    );
  }, 10000);

  it("shows a validation notice without applying invalid search keywords", async () => {
    renderProductList("/products");

    await screen.findByLabelText("キーワード", undefined, { timeout: 8000 });

    fireEvent.change(screen.getByLabelText("キーワード"), {
      target: { value: "a".repeat(101) }
    });
    fireEvent.click(screen.getByRole("button", { name: "絞り込む" }));

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
    renderProductList(`/products?keyword=${"a".repeat(101)}`);

    expect(
      await screen.findByText("検索条件を確認してください。", undefined, {
        timeout: 8000
      })
    ).toBeInTheDocument();

    const productCall = getLatestProductCall();
    expect(productCall).toBeDefined();
    expect(productCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          page: 1,
          pageSize: 50
        })
      })
    );
  }, 10000);

  it("moves between pages with the pagination controls", async () => {
    renderProductList("/products?pageSize=1");

    await screen.findByRole("listitem", undefined, { timeout: 8000 });

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    await waitFor(() => {
      const locationSearch = screen.getByTestId("location-probe").textContent ?? "";
      const searchParams = new URLSearchParams(locationSearch);

      expect(searchParams.get("page")).toBe("2");
      expect(searchParams.get("pageSize")).toBe("1");
    });

    await screen.findByRole("listitem", undefined, { timeout: 8000 });

    const productCall = getLatestProductCall();
    expect(productCall).toBeDefined();
    expect(productCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          page: 2,
          pageSize: 1
        })
      })
    );
  }, 10000);

  it("shows an empty state and clears filters back to the default view", async () => {
    renderProductList("/products?keyword=no-match");

    expect(
    await screen.findByText("条件に合う商品が見つかりませんでした。", undefined, {
      timeout: 8000
    })
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "条件をクリア" })[1]);

    await waitFor(() => {
      const locationSearch = screen.getByTestId("location-probe").textContent ?? "";
      const searchParams = new URLSearchParams(locationSearch);

      expect(searchParams.get("keyword")).toBeNull();
      expect(searchParams.get("status")).toBeNull();
    });

    await screen.findByRole("listitem", undefined, { timeout: 8000 });
  }, 10000);

  it("shows a retry action when product loading fails", async () => {
    productsMode = "error";
    renderProductList("/products");

    expect(
      await screen.findByRole("alert", undefined, { timeout: 8000 })
    ).toBeInTheDocument();

    productsMode = "success";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await screen.findByRole("listitem", undefined, { timeout: 8000 });
  }, 10000);
});
