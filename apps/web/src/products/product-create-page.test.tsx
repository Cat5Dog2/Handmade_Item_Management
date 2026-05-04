import { QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useLocation, MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_PATHS } from "@handmade/shared";
import { ApiClientError } from "../api/api-client";
import { createAppQueryClient } from "../api/query-client";
import { ProductCreatePage } from "./product-create-page";

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderPage(initialEntry = "/products/new") {
  const queryClient = createAppQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={[initialEntry]}
      >
        <LocationProbe />
        <ProductCreatePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProductCreatePage", () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
  });

  it("creates a product and navigates to the detail page", async () => {
    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path === API_PATHS.categories) {
        return {
          data: {
            items: [
              {
                categoryId: "cat-1",
                isInUse: false,
                name: "アクセサリー",
                sortOrder: 1,
                updatedAt: "2026-04-18T00:00:00.000Z",
                usedProductCount: 0
              }
            ]
          }
        };
      }

      if (path === API_PATHS.tags) {
        return {
          data: {
            items: [
              {
                isInUse: false,
                name: "春",
                tagId: "tag-1",
                updatedAt: "2026-04-18T00:00:00.000Z",
                usedProductCount: 0
              },
              {
                isInUse: false,
                name: "限定",
                tagId: "tag-2",
                updatedAt: "2026-04-18T00:00:00.000Z",
                usedProductCount: 0
              }
            ]
          }
        };
      }

      throw new Error(`Unexpected path: ${path}`);
    });
    apiClientMock.post.mockResolvedValue({
      data: {
        createdAt: "2026-04-18T10:00:00.000Z",
        productId: "HM-000123",
        updatedAt: "2026-04-18T10:00:00.000Z"
      }
    });

    renderPage();

    await screen.findByLabelText("商品名");

    fireEvent.input(screen.getByLabelText("商品名"), {
      target: { value: "  ブローチ  " }
    });
    fireEvent.blur(screen.getByLabelText("商品名"));
    fireEvent.input(screen.getByLabelText("商品説明"), {
      target: { value: "春向けの一点物" }
    });
    fireEvent.blur(screen.getByLabelText("商品説明"));
    fireEvent.input(screen.getByLabelText("価格"), {
      target: { value: "2800" }
    });
    fireEvent.blur(screen.getByLabelText("価格"));
    fireEvent.change(screen.getByLabelText("カテゴリ"), {
      target: { value: "cat-1" }
    });
    fireEvent.change(screen.getByLabelText("ステータス"), {
      target: { value: "completed" }
    });
    fireEvent.click(screen.getByLabelText("春"));

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledWith("/products", {
        body: {
          categoryId: "cat-1",
          description: "春向けの一点物",
          name: "ブローチ",
          price: 2800,
          status: "completed",
          tagIds: ["tag-1"]
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "/products/HM-000123"
      );
    });
  });

  it("shows validation errors when required fields are missing", async () => {
    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path === API_PATHS.categories) {
        return {
          data: {
            items: [
              {
                categoryId: "cat-1",
                isInUse: false,
                name: "アクセサリー",
                sortOrder: 1,
                updatedAt: "2026-04-18T00:00:00.000Z",
                usedProductCount: 0
              }
            ]
          }
        };
      }

      if (path === API_PATHS.tags) {
        return {
          data: {
            items: []
          }
        };
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    renderPage();

    await screen.findByLabelText("商品名");

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => {
      expect(apiClientMock.post).not.toHaveBeenCalled();
    });

    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("maps server field errors to the relevant input", async () => {
    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path === API_PATHS.categories) {
        return {
          data: {
            items: [
              {
                categoryId: "cat-1",
                isInUse: false,
                name: "アクセサリー",
                sortOrder: 1,
                updatedAt: "2026-04-18T00:00:00.000Z",
                usedProductCount: 0
              }
            ]
          }
        };
      }

      if (path === API_PATHS.tags) {
        return {
          data: {
            items: []
          }
        };
      }

      throw new Error(`Unexpected path: ${path}`);
    });
    apiClientMock.post.mockRejectedValue(
      new ApiClientError(400, {
        code: "CATEGORY_NOT_FOUND",
        details: [
          {
            field: "categoryId",
            message: "選択したカテゴリは利用できません。"
          }
        ],
        message: "選択したカテゴリは利用できません。"
      })
    );

    renderPage();

    await screen.findByLabelText("商品名");

    fireEvent.input(screen.getByLabelText("商品名"), {
      target: { value: "ブローチ" }
    });
    fireEvent.blur(screen.getByLabelText("商品名"));
    fireEvent.input(screen.getByLabelText("価格"), {
      target: { value: "2800" }
    });
    fireEvent.blur(screen.getByLabelText("価格"));
    fireEvent.change(screen.getByLabelText("カテゴリ"), {
      target: { value: "cat-1" }
    });
    fireEvent.change(screen.getByLabelText("ステータス"), {
      target: { value: "completed" }
    });

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText("指定したカテゴリが見つかりません。カテゴリを選び直してください。")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("カテゴリ")).not.toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});
