import { describe, expect, it, vi } from "vitest";
import { createQrScannerController } from "./qr-scanner-adapter";

function createScannerMock() {
  return {
    clear: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    start: vi.fn(
      async (...args: [unknown, unknown, unknown, unknown]) => {
        void args;
        return null;
      }
    ),
    stop: vi.fn(async () => undefined)
  };
}

describe("createQrScannerController", () => {
  it("starts QR scanning without the library qrbox overlay or forced aspect ratio", async () => {
    const scanner = createScannerMock();
    const controller = createQrScannerController("qr-reader", {
      createScanner: () => scanner
    });

    await controller.start(() => undefined);

    expect(scanner.start).toHaveBeenCalledTimes(1);
    expect(scanner.start.mock.calls[0]?.[1]).toEqual({
      disableFlip: true,
      fps: 10
    });
  });

  it("converts synchronous start errors into rejected promises", async () => {
    const scanner = createScannerMock();
    const startError = new Error("camera failed");
    scanner.start.mockImplementationOnce(() => {
      throw startError;
    });
    const controller = createQrScannerController("qr-reader", {
      createScanner: () => scanner
    });

    await expect(controller.start(() => undefined)).rejects.toThrow(startError);
  });

  it("ignores synchronous stop errors from inactive scanners", async () => {
    const scanner = createScannerMock();
    scanner.stop.mockImplementationOnce(() => {
      throw new Error("scanner is not running");
    });
    const controller = createQrScannerController("qr-reader", {
      createScanner: () => scanner
    });

    await expect(controller.stop()).resolves.toBeUndefined();
  });
});
