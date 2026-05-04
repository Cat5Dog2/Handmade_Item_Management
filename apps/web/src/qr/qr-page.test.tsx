import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import type { QrLookupData } from "@handmade/shared";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../api/api-client";
import { QrPage } from "./qr-page";

const apiClientMock = vi.hoisted(() => ({
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

function renderQrPage() {
  render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={["/qr"]}
    >
      <QrPage />
    </MemoryRouter>
  );
}

describe("QrPage", () => {
  beforeEach(() => {
    apiClientMock.post.mockReset();
    scannerMock.reset();
  });

  it("shows the lookup result and ignores repeated scans while the lookup is pending", async () => {
    let resolveLookup: (value: { data: QrLookupData }) => void = () => undefined;

    apiClientMock.post.mockReturnValue(
      new Promise<{ data: QrLookupData }>((resolve) => {
        resolveLookup = resolve;
      })
    );

    renderQrPage();

    await waitFor(() => {
      expect(scannerMock.start).toHaveBeenCalledTimes(1);
    });

    const successHandler = scannerMock.getSuccessHandler();

    expect(successHandler).not.toBeNull();

    await act(async () => {
      successHandler?.("HM-000001");
      successHandler?.("HM-000001");
    });

    expect(apiClientMock.post).toHaveBeenCalledTimes(1);
    expect(apiClientMock.post).toHaveBeenCalledWith("/qr/lookup", {
      body: {
        qrCodeValue: "HM-000001"
      }
    });
    expect(scannerMock.pause).toHaveBeenCalledWith(true);

    await act(async () => {
      resolveLookup({
        data: {
          canSell: true,
          message: "販売済更新へ進めます。",
          name: "Blue Ribbon",
          productId: "HM-000001",
          reasonCode: "CAN_SELL",
          status: "onDisplay"
        }
      });
    });

    expect(await screen.findByRole("heading", { name: "Blue Ribbon" })).toBeInTheDocument();
    expect(screen.getByText("販売済更新可能")).toBeInTheDocument();
    expect(screen.getAllByText("HM-000001")).toHaveLength(2);
    expect(screen.getByText("販売済更新へ進めます。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await waitFor(() => {
      expect(scannerMock.stop).toHaveBeenCalledTimes(1);
      expect(scannerMock.clear).toHaveBeenCalledTimes(1);
      expect(scannerMock.start).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.getByRole("heading", { name: "読み取り結果" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("QRコードを読み取ると結果が表示されます。")
    ).toBeInTheDocument();
  });

  it("shows a lookup validation error when the API rejects the QR payload", async () => {
    apiClientMock.post.mockRejectedValue(
      new ApiClientError(400, {
        code: "VALIDATION_ERROR",
        message: "validation failed"
      })
    );

    renderQrPage();

    await waitFor(() => {
      expect(scannerMock.start).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      scannerMock.getSuccessHandler()?.("HM-000001");
    });

    expect(
      await screen.findByText("QRコードを読み取ってください。")
    ).toBeInTheDocument();
  });

  it("shows a camera error and allows retrying the scanner startup", async () => {
    scannerMock.start.mockRejectedValueOnce(new Error("camera unavailable"));

    renderQrPage();

    expect(
      await screen.findByText("カメラを利用できません。端末設定を確認してください。")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await waitFor(() => {
      expect(scannerMock.start).toHaveBeenCalledTimes(2);
    });
  });
});
