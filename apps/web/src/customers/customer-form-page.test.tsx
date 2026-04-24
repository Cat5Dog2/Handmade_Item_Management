import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../api/api-client";
import { createAppQueryClient } from "../api/query-client";
import { CustomerFormPage } from "./customer-form-page";

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn()
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
      ...activeCustomerDetailResponse.data.customer,
      archivedAt: "2026-04-22T06:00:00Z",
      isArchived: true
    },
    summary: activeCustomerDetailResponse.data.summary
  }
};

let detailMode: "active" | "archived" | "error" = "active";

function LocationProbe() {
  const location = useLocation();
  const state =
    typeof location.state === "object" && location.state !== null
      ? JSON.stringify(location.state)
      : "";

  return (
    <div data-testid="location-probe">
      {location.pathname}
      {state}
    </div>
  );
}

function renderCustomerForm(initialEntry = "/customers/new") {
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
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:customerId" element={<div>customer detail</div>} />
          <Route path="/customers/:customerId/edit" element={<CustomerFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CustomerFormPage", () => {
  beforeEach(() => {
    detailMode = "active";
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
    apiClientMock.put.mockReset();

    apiClientMock.get.mockImplementation(async (path: string) => {
      if (path !== "/customers/cus_000001") {
        throw new Error(`Unexpected path: ${path}`);
      }

      if (detailMode === "error") {
        throw new Error("boom");
      }

      return detailMode === "archived"
        ? archivedCustomerDetailResponse
        : activeCustomerDetailResponse;
    });
  });

  it("creates a customer with optional fields and navigates to the detail page", async () => {
    apiClientMock.post.mockResolvedValue({
      data: {
        createdAt: "2026-04-22T10:00:00Z",
        customerId: "cus_000123",
        updatedAt: "2026-04-22T10:00:00Z"
      }
    });

    renderCustomerForm();

    fireEvent.input(screen.getByLabelText("顧客名"), {
      target: { value: "  青木 花子  " }
    });
    fireEvent.input(screen.getByLabelText("性別"), {
      target: { value: "女性" }
    });
    fireEvent.input(screen.getByLabelText("年代"), {
      target: { value: "30代" }
    });
    fireEvent.input(screen.getByLabelText("系統メモ"), {
      target: { value: " ナチュラル系 " }
    });
    fireEvent.input(screen.getByLabelText("顧客メモ"), {
      target: { value: "初回来店\r\nメモ" }
    });
    fireEvent.click(screen.getByRole("button", { name: "SNSを追加" }));

    const snsCard = screen.getByRole("heading", { name: "SNSアカウント 1" })
      .closest("article") as HTMLElement;

    fireEvent.input(within(snsCard).getByLabelText("プラットフォーム"), {
      target: { value: " Instagram " }
    });
    fireEvent.input(within(snsCard).getByLabelText("アカウント名"), {
      target: { value: " hanako_handmade " }
    });
    fireEvent.input(within(snsCard).getByLabelText("URL"), {
      target: { value: " https://example.com/hanako " }
    });
    fireEvent.input(within(snsCard).getByLabelText("補足"), {
      target: { value: "DM購入あり" }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "登録する" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledWith("/customers", {
        body: {
          ageGroup: "30代",
          customerStyle: "ナチュラル系",
          gender: "女性",
          memo: "初回来店\nメモ",
          name: "青木 花子",
          snsAccounts: [
            {
              accountName: "hanako_handmade",
              note: "DM購入あり",
              platform: "Instagram",
              url: "https://example.com/hanako"
            }
          ]
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "/customers/cus_000123"
      );
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "顧客を登録しました。"
      );
    });
  });

  it("shows a customer name error when required input is blank", async () => {
    renderCustomerForm();

    fireEvent.input(screen.getByLabelText("顧客名"), {
      target: { value: " " }
    });
    fireEvent.blur(screen.getByLabelText("顧客名"));

    expect(await screen.findByText("顧客名を入力してください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登録する" })).toBeDisabled();
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("loads an existing customer and updates it", async () => {
    apiClientMock.put.mockResolvedValue({
      data: {
        customerId: "cus_000001",
        updatedAt: "2026-04-22T10:00:00Z"
      }
    });

    renderCustomerForm("/customers/cus_000001/edit");

    expect(await screen.findByDisplayValue("山田 花子")).toBeInTheDocument();
    expect(screen.getByDisplayValue("@hanako")).toBeInTheDocument();

    fireEvent.input(screen.getByLabelText("顧客名"), {
      target: { value: "山田 華子" }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "更新する" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(apiClientMock.put).toHaveBeenCalledWith("/customers/cus_000001", {
        body: {
          ageGroup: "30代",
          customerStyle: "ナチュラル系",
          gender: "女性",
          memo: "春色アクセサリーをよく購入する",
          name: "山田 華子",
          snsAccounts: [
            {
              accountName: "@hanako",
              note: "DMで連絡",
              platform: "Instagram",
              url: "https://example.com/hanako"
            }
          ]
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "/customers/cus_000001"
      );
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "顧客情報を更新しました。"
      );
    });
  });

  it("maps server validation details to the matching field", async () => {
    apiClientMock.post.mockRejectedValue(
      new ApiClientError(400, {
        code: "VALIDATION_ERROR",
        details: [
          {
            field: "customerStyle",
            message: "String must contain at most 100 character(s)"
          }
        ],
        message: "入力内容を確認してください。"
      })
    );

    renderCustomerForm();

    fireEvent.input(screen.getByLabelText("顧客名"), {
      target: { value: "青木 花子" }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "登録する" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    expect(
      await screen.findByText("系統メモは100文字以内で入力してください。")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("系統メモ")).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps archived customers read-only on the edit page", async () => {
    detailMode = "archived";

    renderCustomerForm("/customers/cus_000001/edit");

    expect(
      await screen.findByText(
        "アーカイブ済みの顧客は編集できません。詳細画面で内容をご確認ください。"
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "詳細へ戻る" })).toHaveAttribute(
      "href",
      "/customers/cus_000001"
    );
    expect(screen.getByRole("button", { name: "更新する" })).toBeDisabled();
  });

  it("shows a retry action when loading the edit target fails", async () => {
    detailMode = "error";

    renderCustomerForm("/customers/cus_000001/edit");

    expect(
      await screen.findByText("顧客情報を取得できませんでした。")
    ).toBeInTheDocument();

    detailMode = "active";
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByDisplayValue("山田 花子")).toBeInTheDocument();
  });
});
