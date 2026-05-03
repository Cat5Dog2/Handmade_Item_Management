import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  API_PATHS,
  getProductImagePath,
  getProductImagesPath,
  getProductPath
} from "@handmade/shared";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../api/api-client";
import { createAppQueryClient } from "../api/query-client";
import { ProductEditPage } from "./product-edit-page";

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn()
}));

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
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

const productDetailAfterImageAddResponse = {
  data: {
    ...productDetailResponse.data,
    images: [
      ...productDetailResponse.data.images,
      {
        displayUrl: "https://example.com/display-added.webp",
        imageId: "image-3",
        isPrimary: false,
        sortOrder: 3,
        thumbnailUrl: "https://example.com/thumb-added.webp",
        urlExpiresAt: "2026-04-25T12:30:00Z"
      }
    ]
  }
};

const productDetailAfterImageReplaceResponse = {
  data: {
    ...productDetailResponse.data,
    images: productDetailResponse.data.images.map((image) =>
      image.imageId === "image-1"
        ? {
            ...image,
            displayUrl: "https://example.com/display-1-updated.webp",
            thumbnailUrl: "https://example.com/thumb-1-updated.webp",
            urlExpiresAt: "2026-04-25T12:30:00Z"
          }
        : image
    )
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

const categoriesResponse = {
  data: {
    items: [
      {
        categoryId: "cat-1",
        isInUse: true,
        name: "アクセサリー",
        sortOrder: 1,
        updatedAt: "2026-04-18T00:00:00.000Z",
        usedProductCount: 1
      },
      {
        categoryId: "cat-2",
        isInUse: false,
        name: "雑貨",
        sortOrder: 2,
        updatedAt: "2026-04-18T00:00:00.000Z",
        usedProductCount: 0
      }
    ]
  }
};

const tagsResponse = {
  data: {
    items: [
      {
        isInUse: true,
        name: "春",
        tagId: "tag-1",
        updatedAt: "2026-04-18T00:00:00.000Z",
        usedProductCount: 1
      },
      {
        isInUse: true,
        name: "一点もの",
        tagId: "tag-2",
        updatedAt: "2026-04-18T00:00:00.000Z",
        usedProductCount: 1
      }
    ]
  }
};

const customersResponse = {
  data: {
    items: [
      {
        ageGroup: "30代",
        customerId: "cus_000001",
        customerStyle: "ナチュラル系",
        gender: "女性",
        lastPurchaseAt: "2026-04-23T11:00:00Z",
        lastPurchaseProductId: "HM-000010",
        lastPurchaseProductName: "Green Brooch",
        name: "山田 花子",
        purchaseCount: 2,
        updatedAt: "2026-04-20T00:00:00Z"
      },
      {
        ageGroup: null,
        customerId: "cus_000002",
        customerStyle: null,
        gender: null,
        lastPurchaseAt: null,
        lastPurchaseProductId: null,
        lastPurchaseProductName: null,
        name: "佐藤 空",
        purchaseCount: 0,
        updatedAt: "2026-04-19T00:00:00Z"
      }
    ]
  }
};

let detailMode: "success" | "sold" | "error" = "success";

function createImageUploadFile(name: string, type = "image/png") {
  return new File(["image-data"], name, { type });
}

function mockProductEditLookups(
  productResponses: Array<typeof productDetailResponse> = [productDetailResponse]
) {
  let productResponseIndex = 0;

  apiClientMock.get.mockImplementation(async (path: string) => {
    if (path === getProductPath("HM-000001")) {
      if (detailMode === "error") {
        throw new Error("boom");
      }

      if (detailMode === "sold") {
        return soldProductDetailResponse;
      }

      const nextResponse =
        productResponses[Math.min(productResponseIndex, productResponses.length - 1)];
      productResponseIndex += 1;
      return nextResponse;
    }

    if (path === API_PATHS.categories) {
      return categoriesResponse;
    }

    if (path === API_PATHS.tags) {
      return tagsResponse;
    }

    if (path === API_PATHS.customers) {
      return customersResponse;
    }

    throw new Error(`Unexpected path: ${path}`);
  });
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderProductEdit(initialEntry = "/products/HM-000001/edit") {
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
          <Route path="/products/:productId" element={<div>product detail</div>} />
          <Route path="/products/:productId/edit" element={<ProductEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProductEditPage", () => {
  beforeEach(() => {
    detailMode = "success";
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
    apiClientMock.put.mockReset();

    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path === getProductPath("HM-000001")) {
        if (detailMode === "error") {
          throw new Error("boom");
        }

        return detailMode === "sold"
          ? soldProductDetailResponse
          : productDetailResponse;
      }

      if (path === API_PATHS.categories) {
        return categoriesResponse;
      }

      if (path === API_PATHS.tags) {
        return tagsResponse;
      }

      if (path === API_PATHS.customers) {
        return customersResponse;
      }

      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("loads product values and updates a sold product with an optional customer", async () => {
    apiClientMock.put.mockResolvedValue({
      data: {
        productId: "HM-000001",
        updatedAt: "2026-04-25T10:00:00Z"
      }
    });

    renderProductEdit();

    expect(await screen.findByDisplayValue("Blue Ribbon")).toBeInTheDocument();
    expect(screen.getByLabelText("商品ID")).toHaveValue("HM-000001");
    expect(screen.getByLabelText("価格")).toHaveValue(2800);
    expect(screen.getByLabelText("カテゴリ")).toHaveValue("cat-1");
    expect(screen.getByLabelText("ステータス")).toHaveValue("onDisplay");
    expect(screen.getByLabelText("春")).toBeChecked();
    expect(screen.getByLabelText("一点もの")).toBeChecked();

    fireEvent.input(screen.getByLabelText("商品名"), {
      target: { value: "  Blue Ribbon Updated  " }
    });
    fireEvent.input(screen.getByLabelText("価格"), {
      target: { value: "3200" }
    });
    fireEvent.change(screen.getByLabelText("ステータス"), {
      target: { value: "sold" }
    });
    fireEvent.change(await screen.findByLabelText("購入者"), {
      target: { value: "cus_000001" }
    });

    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(apiClientMock.put).toHaveBeenCalledWith(
        getProductPath("HM-000001"),
        {
          body: {
            categoryId: "cat-1",
            description: "春色のリボンです。",
            name: "Blue Ribbon Updated",
            price: 3200,
            primaryImageId: "image-2",
            soldCustomerId: "cus_000001",
            status: "sold",
            tagIds: ["tag-1", "tag-2"]
          }
        }
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "/products/HM-000001"
      );
    });
  });

  it("confirms before returning a sold product to a non-sold status", async () => {
    detailMode = "sold";
    apiClientMock.put.mockResolvedValue({
      data: {
        productId: "HM-000001",
        updatedAt: "2026-04-25T10:00:00Z"
      }
    });

    renderProductEdit();

    expect(await screen.findByLabelText("購入者")).toHaveValue("cus_000001");

    fireEvent.change(screen.getByLabelText("ステータス"), {
      target: { value: "onDisplay" }
    });
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    const dialog = await screen.findByRole("dialog", {
      name: "販売済戻し確認"
    });

    expect(apiClientMock.put).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText(
        "販売済からステータスを戻すと販売日時が解除されます。よろしいですか？"
      )
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(apiClientMock.put).toHaveBeenCalledWith(
        getProductPath("HM-000001"),
        {
          body: expect.objectContaining({
            primaryImageId: "image-2",
            soldCustomerId: null,
            status: "onDisplay"
          })
        }
      );
    });
  });

  it("maps server customer errors to the purchaser field", async () => {
    apiClientMock.put.mockRejectedValue(
      new ApiClientError(400, {
        code: "CUSTOMER_ARCHIVED",
        details: [
          {
            field: "soldCustomerId",
            message: "選択した顧客は利用できません。"
          }
        ],
        message: "選択した顧客は利用できません。"
      })
    );

    renderProductEdit();

    await screen.findByDisplayValue("Blue Ribbon");

    fireEvent.change(screen.getByLabelText("ステータス"), {
      target: { value: "sold" }
    });
    fireEvent.change(await screen.findByLabelText("購入者"), {
      target: { value: "cus_000001" }
    });
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    expect(
      await screen.findByText("選択した顧客は利用できません。")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("購入者")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("shows a retry action when edit lookups fail", async () => {
    detailMode = "error";

    renderProductEdit();

    expect(
      await screen.findByText("商品編集に必要な情報を取得できませんでした。再試行してください。")
    ).toBeInTheDocument();

    detailMode = "success";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByDisplayValue("Blue Ribbon")).toBeInTheDocument();
  });

  it("adds a product image and refreshes the edited image list", async () => {
    mockProductEditLookups([
      productDetailResponse,
      productDetailAfterImageAddResponse
    ]);
    apiClientMock.post.mockResolvedValue({
      data: {
        imageId: "image-3",
        updatedAt: "2026-04-25T10:00:00Z"
      }
    });

    renderProductEdit();

    expect(await screen.findByDisplayValue("Blue Ribbon")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "画像を追加" }));
    const uploadInput = screen.getByTestId("product-image-upload-input");
    const uploadFile = createImageUploadFile("new-image.png");

    fireEvent.change(uploadInput, {
      target: { files: [uploadFile] }
    });

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledWith(
        getProductImagesPath("HM-000001"),
        {
          body: expect.any(FormData)
        }
      );
    });

    const requestOptions = apiClientMock.post.mock.calls[0][1];
    expect(requestOptions.body).toBeInstanceOf(FormData);
    expect((requestOptions.body as FormData).get("file")).toBe(uploadFile);

    await waitFor(() => {
      expect(
        apiClientMock.get.mock.calls.filter(
          ([path]) => path === getProductPath("HM-000001")
        )
      ).toHaveLength(2);
    });

    expect(
      await screen.findByRole("img", { name: "Blue Ribbon の画像 3" })
    ).toHaveAttribute("src", "https://example.com/thumb-added.webp");
  });

  it("replaces an existing product image and refreshes the edited image list", async () => {
    mockProductEditLookups([
      productDetailResponse,
      productDetailAfterImageReplaceResponse
    ]);
    apiClientMock.put.mockResolvedValue({
      data: {
        imageId: "image-1",
        updatedAt: "2026-04-25T10:00:00Z"
      }
    });

    renderProductEdit();

    expect(await screen.findByDisplayValue("Blue Ribbon")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Blue Ribbon の画像 2 を差し替える"
      })
    );
    const uploadInput = screen.getByTestId("product-image-upload-input");
    const uploadFile = createImageUploadFile("replaced-image.webp", "image/webp");

    fireEvent.change(uploadInput, {
      target: { files: [uploadFile] }
    });

    await waitFor(() => {
      expect(apiClientMock.put).toHaveBeenCalledWith(
        getProductImagePath("HM-000001", "image-1"),
        {
          body: expect.any(FormData)
        }
      );
    });

    const requestOptions = apiClientMock.put.mock.calls[0][1];
    expect(requestOptions.body).toBeInstanceOf(FormData);
    expect((requestOptions.body as FormData).get("file")).toBe(uploadFile);

    await waitFor(() => {
      expect(
        apiClientMock.get.mock.calls.filter(
          ([path]) => path === getProductPath("HM-000001")
        )
      ).toHaveLength(2);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Blue Ribbon の画像 2" })
      ).toHaveAttribute("src", "https://example.com/thumb-1-updated.webp");
    });
  });

  it("shows a friendly message when an image upload is rejected", async () => {
    mockProductEditLookups();
    apiClientMock.post.mockRejectedValue(
      new ApiClientError(400, {
        code: "UNSUPPORTED_IMAGE_TYPE",
        details: [],
        message: "Unsupported image type"
      })
    );

    renderProductEdit();

    expect(await screen.findByDisplayValue("Blue Ribbon")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "画像を追加" }));
    fireEvent.change(screen.getByTestId("product-image-upload-input"), {
      target: { files: [createImageUploadFile("invalid.gif", "image/gif")] }
    });

    expect(
      await screen.findByText("JPEG、PNG、WebP 形式の画像を選択してください。")
    ).toBeInTheDocument();
    expect(
      apiClientMock.get.mock.calls.filter(
        ([path]) => path === getProductPath("HM-000001")
      )
    ).toHaveLength(1);
  });
});
