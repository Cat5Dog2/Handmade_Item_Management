import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeCameraScanConfig
} from "html5-qrcode";

const QR_CAMERA_SCAN_CONFIG: Html5QrcodeCameraScanConfig = {
  disableFlip: true,
  fps: 10
};

type Html5QrcodeLike = Pick<Html5Qrcode, "clear" | "pause" | "resume" | "start" | "stop">;

export interface QrScannerController {
  clear(): void;
  pause(shouldPauseVideo?: boolean): void;
  resume(): void;
  start(onSuccess: (decodedText: string) => void): Promise<null>;
  stop(): Promise<void>;
}

export interface CreateQrScannerControllerOptions {
  createScanner?: (elementId: string) => Html5QrcodeLike;
}

export function createQrScannerController(
  elementId: string,
  options: CreateQrScannerControllerOptions = {}
): QrScannerController {
  const scanner =
    options.createScanner?.(elementId) ??
    new Html5Qrcode(elementId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false
    });

  return {
    clear() {
      scanner.clear();
    },
    pause(shouldPauseVideo = true) {
      scanner.pause(shouldPauseVideo);
    },
    resume() {
      scanner.resume();
    },
    start(onSuccess) {
      try {
        return scanner.start(
          { facingMode: "environment" },
          QR_CAMERA_SCAN_CONFIG,
          (decodedText) => {
            onSuccess(decodedText);
          },
          () => undefined
        );
      } catch (error) {
        return Promise.reject(error);
      }
    },
    stop() {
      try {
        return scanner.stop();
      } catch {
        return Promise.resolve();
      }
    }
  };
}
