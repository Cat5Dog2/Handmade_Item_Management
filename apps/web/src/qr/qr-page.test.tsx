import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type { CustomerListData, QrSellData } from "@handmade/shared";
import { API_PATHS, PRODUCT_STATUS_LABELS } from "@handmade/shared";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../api/api-client";
import { createAppQueryClient } from "../api/query-client";
import { QrPage } from "./qr-page";

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

const scannerMock = vi.hoisted(() => {
  let successHandler: ((decodedText: string) => void) | null = null;
  const clear = vi.fn();
  const pause = vi.fn();
  const resume = vi.fn();
  const start = vi.fn(async (onSuccess: (decodedText: string) => void) => {
    successHandler = onSuccess;
    return null;
  });
  const stop = vi.fn(async () => undefined);

  return {
    clear,
    pause,
    resume,
    start,
    stop,
    getSuccessHandler() {
      return successHandler;
    },
    reset() {
      successHandler = null;
      clear.mockClear();
      pause.mockClear();
      resume.mockClear();
      start.mockClear();
      stop.mockClear();
    }
  };
});

vi.mock("../api/api-client-context", () => ({
  useApiClient: () => apiClientMock
}));

vi.mock("./qr-scanner-adapter", () => ({
  createQrScannerController: () => scannerMock
}));

const lookupResponse = {
  data: {
    canSell: true,
    message: "販売済に更新できます。",
    name: "Blue Ribbon",
    productId: "HM-000001",
    reasonCode: "CAN_SELL",
    status: "onDisplay" as const
  }
};

const emptyCustomerListResponse: { data: CustomerListData } = {
  data: {
    items: []
  }
};

const customerListResponse: { data: CustomerListData } = {
  data: {
    items: [
      {
        ageGroup: null,
        customerId: "cus_000001",
        customerStyle: null,
        gender: null,
        lastPurchaseAt: null,
        lastPurchaseProductId: null,
        lastPurchaseProductName: null,
        name: "山田 花子",
        purchaseCount: 0,
        updatedAt: "2026-04-22T10:00:00Z"
      }
    ]
  }
};

const sellResponse = {
  data: {
    productId: "HM-000001",
    soldAt: "2026-04-23T09:00:00Z",
    soldCustomerId: null,
    soldCustomerNameSnapshot: null,
    status: "sold" as const,
    updatedAt: "2026-04-23T09:00:00Z"
  }
};

function renderQrPage() {
  const queryClient = createAppQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={["/qr"]}
      >
        <QrPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("QrPage", () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
    scannerMock.reset();
  });

  it("opens the confirmation dialog and returns to the scanner when canceled", async () => {
    apiClientMock.get.mockResolvedValue(emptyCustomerListResponse);
    apiClientMock.post.mockImplementation(async (path: string) => {
      if (path === API_PATHS.qrLookup) {
        return lookupResponse;
      }

      throw new Error(`Unexpected POST path: ${path}`);
    });

    renderQrPage();

    await waitFor(() => {
      expect(scannerMock.start).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      scannerMock.getSuccessHandler()?.("HM-000001");
    });

    expect(await screen.findByRole("heading", { name: "Blue Ribbon" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "購入者" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "販売済更新" }));

    const dialog = screen.getByRole("dialog", { name: "販売済更新確認" });
    expect(within(dialog).getByText("Blue Ribbon")).toBeInTheDocument();
    expect(within(dialog).getByText("HM-000001")).toBeInTheDocument();
    expect(within(dialog).getByText(PRODUCT_STATUS_LABELS.onDisplay)).toBeInTheDocument();
    expect(within(dialog).getByText("未選択")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "販売済更新確認" })).not.toBeInTheDocument();
    });
  });

  it("confirms sale without a customer and shows the success message", async () => {
    apiClientMock.get.mockResolvedValue(emptyCustomerListResponse);
    apiClientMock.post.mockImplementation(async (path: string, options?: { body?: unknown }) => {
      if (path === API_PATHS.qrLookup) {
        return lookupResponse;
      }

      if (path === API_PATHS.qrSell) {
        expect(options?.body).toEqual({
          productId: "HM-000001"
        });

        return sellResponse;
      }

      throw new Error(`Unexpected POST path: ${path}`);
    });

    renderQrPage();

    await waitFor(() => {
      expect(scannerMock.start).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      scannerMock.getSuccessHandler()?.("HM-000001");
    });

    fireEvent.click(await screen.findByRole("button", { name: "販売済更新" }));
    fireEvent.click(screen.getByRole("button", { name: "販売済に更新" }));

    expect(await screen.findByText("販売済更新が完了しました。")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "販売済更新確認" })).not.toBeInTheDocument();
    expect(screen.getByText(PRODUCT_STATUS_LABELS.sold)).toBeInTheDocument();
  });

  it("disables the confirmation dialog while the sale request is pending", async () => {
    apiClientMock.get.mockResolvedValue(customerListResponse);

    let resolveSell: (value: { data: QrSellData }) => void = () => undefined;

    apiClientMock.post.mockImplementation(async (path: string, options?: { body?: unknown }) => {
      if (path === API_PATHS.qrLookup) {
        return lookupResponse;
      }

      if (path === API_PATHS.qrSell) {
        expect(options?.body).toEqual({
          customerId: "cus_000001",
          productId: "HM-000001"
        });

        return new Promise<{ data: QrSellData }>((resolve) => {
          resolveSell = resolve;
        });
      }

      throw new Error(`Unexpected POST path: ${path}`);
    });

    renderQrPage();

    await waitFor(() => {
      expect(scannerMock.start).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      scannerMock.getSuccessHandler()?.("HM-000001");
    });

    fireEvent.change(screen.getByRole("combobox", { name: "購入者" }), {
      target: {
        value: "cus_000001"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "販売済更新" }));
    fireEvent.click(screen.getByRole("button", { name: "販売済に更新" }));

    const dialog = screen.getByRole("dialog", { name: "販売済更新確認" });
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: "販売済に更新" })).toBeDisabled();
    });

    expect(apiClientMock.post).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSell({
        data: {
          productId: "HM-000001",
          soldAt: "2026-04-23T09:00:00Z",
          soldCustomerId: "cus_000001",
          soldCustomerNameSnapshot: "山田 花子",
          status: "sold",
          updatedAt: "2026-04-23T09:00:00Z"
        }
      });
    });
  });

  it("shows a sale validation error when the API rejects the selected customer", async () => {
    apiClientMock.get.mockResolvedValue(customerListResponse);
    apiClientMock.post.mockImplementation(async (path: string) => {
      if (path === API_PATHS.qrLookup) {
        return lookupResponse;
      }

      if (path === API_PATHS.qrSell) {
        throw new ApiClientError(400, {
          code: "CUSTOMER_ARCHIVED",
          message: "validation failed"
        });
      }

      throw new Error(`Unexpected POST path: ${path}`);
    });

    renderQrPage();

    await waitFor(() => {
      expect(scannerMock.start).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      scannerMock.getSuccessHandler()?.("HM-000001");
    });

    fireEvent.change(screen.getByRole("combobox", { name: "購入者" }), {
      target: {
        value: "cus_000001"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "販売済更新" }));
    fireEvent.click(screen.getByRole("button", { name: "販売済に更新" }));

    expect(
      await screen.findByText("選択した顧客は現在利用できません。別の顧客を選択してください。")
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "販売済更新確認" })).toBeInTheDocument();
  });
});
