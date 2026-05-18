import { QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { useLocation, MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_PATHS } from "@handmade/shared";
import { createAppQueryClient } from "../api/query-client";
import { ProductListPage } from "./product-list-page";

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
  isCustomOrder: true,
  isLimitedStock: true,
  name: "Blue Ribbon",
  productId: "HM-000001",
  status: "consignmentSale" as const,
  thumbnailUrl: "https://example.com/thumb-1.webp",
  updatedAt: "2026-04-18T00:00:00Z"
};

const soldProduct = {
  categoryName: "アクセサリー",
  isCustomOrder: false,
  isLimitedStock: false,
  name: "Sold Ribbon",
  productId: "HM-000002",
  status: "sold" as const,
  thumbnailUrl: null,
  updatedAt: "2026-04-17T00:00:00Z"
};

const bulkPrintProducts = Array.from({ length: 31 }, (_, index) => {
  const productNumber = index + 1;
  const productId = `HM-${String(productNumber).padStart(6, "0")}`;

  return {
    categoryName: "アクセサリー",
    isCustomOrder: false,
    isLimitedStock: false,
    name: `Bulk Product ${String(productNumber).padStart(2, "0")}`,
    productId,
    status: "inStock" as const,
    thumbnailUrl: null,
    updatedAt: "2026-04-18T00:00:00Z"
  };
});

let productsMode: "success" | "error" = "success";
let printMock: ReturnType<typeof vi.fn>;
let resolveDelayedProducts: ((value: unknown) => void) | null;
let scrollToMock: ReturnType<typeof vi.fn>;

function createDomRect(top: number, height: number) {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 390,
    top,
    width: 390,
    x: 0,
    y: top,
    toJSON: () => ({})
  } as DOMRect;
}

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

async function ensureProductFiltersOpen() {
  if (screen.queryByRole("button", { name: "検索条件を閉じる" })) {
    return;
  }

  fireEvent.click(
    await screen.findByRole(
      "button",
      { name: "検索条件を開く" },
      {
        timeout: 8000
      }
    )
  );
}

describe("ProductListPage", () => {
  beforeEach(() => {
    productsMode = "success";
    apiClientMock.get.mockReset();
    qrCodeMock.toString.mockReset();
    qrCodeMock.toString.mockResolvedValue('<svg viewBox="0 0 10 10"></svg>');
    printMock = vi.fn();
    resolveDelayedProducts = null;
    scrollToMock = vi.fn();
    document
      .querySelectorAll(".app-header")
      .forEach((element) => element.remove());
    Object.defineProperty(window, "print", {
      configurable: true,
      value: printMock
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: scrollToMock
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 240
    });
    Object.defineProperty(
      window.HTMLElement.prototype,
      "getBoundingClientRect",
      {
        configurable: true,
        value(this: HTMLElement) {
          if (this.classList.contains("app-header")) {
            return createDomRect(0, 80);
          }

          if (this.classList.contains("product-list-print-toolbar")) {
            return createDomRect(580, 120);
          }

          return createDomRect(0, 0);
        }
      }
    );
    apiClientMock.get.mockImplementation(
      async (path: string, options?: { query?: Record<string, unknown> }) => {
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

          if (keyword === "delayed") {
            return new Promise((resolve) => {
              resolveDelayedProducts = resolve;
            });
          }

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

          if (keyword === "bulk") {
            return {
              data: {
                items: bulkPrintProducts
              },
              meta: {
                hasNext: false,
                page,
                pageSize,
                totalCount: bulkPrintProducts.length
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
      }
    );
  }, 10000);

  it("renders the current query state and product cards", async () => {
    renderProductList(
      "/products?keyword=blue&status=consignmentSale&customOrder=only&limitedStock=exclude&sortBy=name&sortOrder=asc"
    );

    await screen.findByRole("listitem", undefined, { timeout: 8000 });

    expect(screen.getByLabelText("キーワード")).toHaveValue("blue");
    expect(screen.getByLabelText("ステータス")).toHaveValue("consignmentSale");
    expect(screen.getByLabelText("販売済み")).toHaveValue("true");
    expect(screen.getByLabelText("特注")).toHaveValue("only");
    expect(screen.getByLabelText("在庫限り")).toHaveValue("exclude");

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
          customOrder: "only",
          limitedStock: "exclude",
          sortBy: "name",
          sortOrder: "asc",
          status: "consignmentSale"
        })
      })
    );
  }, 10000);

  it("collapses product filters by default and expands them from the header control", async () => {
    renderProductList("/products");

    await screen.findByRole("listitem", undefined, { timeout: 8000 });

    const toggleButton = screen.getByRole("button", {
      name: "検索条件を開く"
    });

    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("キーワード")).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(
      screen.getByRole("button", { name: "検索条件を閉じる" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("キーワード")).toBeInTheDocument();
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
      await screen.findByText("商品を削除しました。", undefined, {
        timeout: 8000
      })
    ).toBeInTheDocument();
  }, 10000);

  it("applies filters through the URL and keeps sold results enabled", async () => {
    renderProductList("/products");

    await ensureProductFiltersOpen();
    await screen.findByLabelText("キーワード", undefined, { timeout: 8000 });

    fireEvent.change(screen.getByLabelText("キーワード"), {
      target: { value: "gold" }
    });
    fireEvent.change(screen.getByLabelText("ステータス"), {
      target: { value: "sold" }
    });
    fireEvent.change(screen.getByLabelText("特注"), {
      target: { value: "only" }
    });
    fireEvent.change(screen.getByLabelText("在庫限り"), {
      target: { value: "exclude" }
    });

    expect(screen.getByLabelText("販売済み")).toHaveValue("true");
    expect(screen.getByLabelText("販売済み")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "絞り込む" }));

    await waitFor(() => {
      const locationSearch =
        screen.getByTestId("location-probe").textContent ?? "";
      const searchParams = new URLSearchParams(locationSearch);

      expect(searchParams.get("keyword")).toBe("gold");
      expect(searchParams.get("status")).toBe("sold");
      expect(searchParams.get("includeSold")).toBe("true");
      expect(searchParams.get("customOrder")).toBe("only");
      expect(searchParams.get("limitedStock")).toBe("exclude");
    });

    const productCall = getLatestProductCall();
    expect(productCall).toBeDefined();
    expect(productCall?.[1]).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          includeSold: true,
          keyword: "gold",
          customOrder: "only",
          limitedStock: "exclude",
          page: 1,
          status: "sold"
        })
      })
    );
  }, 10000);

  it("keeps the previous product list visible while filter results are refetching", async () => {
    renderProductList("/products");

    await screen.findByText("Blue Ribbon", undefined, { timeout: 8000 });
    await ensureProductFiltersOpen();

    const keywordInput = screen.getByRole("searchbox");

    fireEvent.change(keywordInput, {
      target: { value: "delayed" }
    });
    fireEvent.submit(keywordInput.closest("form") as HTMLFormElement);

    await waitFor(() => {
      const locationSearch =
        screen.getByTestId("location-probe").textContent ?? "";
      expect(new URLSearchParams(locationSearch).get("keyword")).toBe(
        "delayed"
      );
      expect(resolveDelayedProducts).not.toBeNull();
    });

    expect(screen.getByText("Blue Ribbon")).toBeInTheDocument();

    resolveDelayedProducts?.({
      data: {
        items: [soldProduct]
      },
      meta: {
        hasNext: false,
        page: 1,
        pageSize: 50,
        totalCount: 1
      }
    });

    expect(await screen.findByText("Sold Ribbon")).toBeInTheDocument();
  }, 10000);

  it("shows a validation notice without applying invalid search keywords", async () => {
    renderProductList("/products");

    await ensureProductFiltersOpen();
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
      const locationSearch =
        screen.getByTestId("location-probe").textContent ?? "";
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
      await screen.findByText(
        "条件に合う商品が見つかりませんでした。",
        undefined,
        {
          timeout: 8000
        }
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "条件をクリア" })[1]);

    await waitFor(() => {
      const locationSearch =
        screen.getByTestId("location-probe").textContent ?? "";
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

  it("prints selected QR codes in bulk from one selected product", async () => {
    renderProductList("/products?keyword=bulk");

    await screen.findByText("Bulk Product 01", undefined, { timeout: 8000 });

    fireEvent.click(screen.getByRole("button", { name: "まとめて印刷" }));

    fireEvent.click(screen.getByRole("listitem", { name: "Bulk Product 01" }));
    expect(screen.getByText("1 / 30件選択中")).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "Bulk Product 01" })
    ).toHaveClass("product-list-card--selected");

    fireEvent.click(screen.getByRole("listitem", { name: "Bulk Product 01" }));
    expect(screen.getByText("0 / 30件選択中")).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "Bulk Product 01" })
    ).not.toHaveClass("product-list-card--selected");

    fireEvent.click(screen.getByRole("listitem", { name: "Bulk Product 01" }));
    expect(screen.getByText("1 / 30件選択中")).toBeInTheDocument();

    const printArea = screen.getByLabelText("まとめて印刷用QRコード");
    expect(within(printArea).getAllByRole("listitem")).toHaveLength(1);
    expect(within(printArea).getByText("Bulk Product 01")).toBeInTheDocument();
    expect(within(printArea).getByText("HM-000001")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "選択したQRを印刷" })
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "選択したQRを印刷" }));

    expect(printMock).toHaveBeenCalledTimes(1);
  }, 10000);

  it("limits bulk QR printing selection to thirty products", async () => {
    renderProductList("/products?keyword=bulk");

    await screen.findByText("Bulk Product 01", undefined, { timeout: 8000 });

    fireEvent.click(screen.getByRole("button", { name: "まとめて印刷" }));
    fireEvent.click(screen.getByRole("listitem", { name: "Bulk Product 01" }));

    expect(
      screen.getByLabelText("Bulk Product 31を印刷対象に選択")
    ).toBeEnabled();

    for (const product of bulkPrintProducts.slice(1, 30)) {
      fireEvent.click(screen.getByLabelText(`${product.name}を印刷対象に選択`));
    }

    expect(screen.getByText("30 / 30件選択中")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Bulk Product 31を印刷対象に選択")
    ).toBeDisabled();

    const printArea = screen.getByLabelText("まとめて印刷用QRコード");
    expect(within(printArea).getAllByRole("listitem")).toHaveLength(30);
    expect(within(printArea).getByText("Bulk Product 01")).toBeInTheDocument();
    expect(within(printArea).getByText("HM-000030")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "選択したQRを印刷" })
      ).toBeEnabled();
    });
  }, 10000);

  it("scrolls to the bulk print selection toolbar when bulk print mode starts", async () => {
    const headerElement = document.createElement("header");
    headerElement.className = "app-header";
    document.body.append(headerElement);

    renderProductList("/products?keyword=bulk");

    await screen.findByText("Bulk Product 01", undefined, { timeout: 8000 });

    fireEvent.click(screen.getByRole("button", { name: "まとめて印刷" }));

    expect(
      screen
        .getByRole("heading", { name: "まとめて印刷" })
        .closest(".product-list-print-toolbar")
    ).toHaveStyle({ top: "92px" });

    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledWith({
        behavior: "smooth",
        top: 728
      });
    });
  }, 10000);
});
