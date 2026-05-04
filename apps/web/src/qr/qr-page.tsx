import type { QrLookupData } from "@handmade/shared";
import { API_PATHS, PRODUCT_STATUS_LABELS } from "@handmade/shared";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { useApiClient } from "../api/api-client-context";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import {
  APP_NAME,
  QR_ERROR_MESSAGES,
  QR_LOOKUP_ERROR_MESSAGE_OVERRIDES
} from "../messages/display-messages";
import { createQrScannerController } from "./qr-scanner-adapter";

interface QrLaunchContext {
  productId: string;
  qrCodeValue: string;
}

type CameraState = "starting" | "ready" | "paused" | "error";
type LookupState = "idle" | "pending" | "success" | "error";

function isQrLaunchContext(value: unknown): value is QrLaunchContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QrLaunchContext>;

  return (
    typeof candidate.productId === "string" &&
    typeof candidate.qrCodeValue === "string"
  );
}

function getScannerStatusMessage(cameraState: CameraState, lookupState: LookupState) {
  if (cameraState === "starting") {
    return "カメラを起動しています...";
  }

  if (cameraState === "ready") {
    return "QRコードを枠内に合わせてください。";
  }

  if (cameraState === "paused" && lookupState === "pending") {
    return "読み取り結果を確認しています...";
  }

  return "再試行で新しいQR読み取りを開始できます。";
}

function formatLookupDetail(value: string | null) {
  return value ?? "未取得";
}

export function QrPage() {
  const apiClient = useApiClient();
  const location = useLocation();
  const scannerContainerId = useId().replace(/:/g, "-");
  const lookupLockRef = useRef(false);
  const launchContext = isQrLaunchContext(location.state) ? location.state : null;

  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupResult, setLookupResult] = useState<QrLookupData | null>(null);
  const [lookupErrorMessage, setLookupErrorMessage] = useState<string | null>(null);
  const [scannerErrorMessage, setScannerErrorMessage] = useState<string | null>(null);
  const [lastScannedValue, setLastScannedValue] = useState<string | null>(null);
  const [scanSessionId, setScanSessionId] = useState(0);

  const handleRetry = () => {
    lookupLockRef.current = false;
    setCameraState("starting");
    setLookupState("idle");
    setLookupResult(null);
    setLookupErrorMessage(null);
    setLastScannedValue(null);
    setScannerErrorMessage(null);
    setScanSessionId((current) => current + 1);
  };

  useEffect(() => {
    let isCancelled = false;
    const scanner = createQrScannerController(scannerContainerId);
    lookupLockRef.current = false;
    setCameraState("starting");
    setScannerErrorMessage(null);

    void scanner
      .start(async (decodedText) => {
        if (isCancelled || lookupLockRef.current) {
          return;
        }

        const qrCodeValue = decodedText.trim();

        if (!qrCodeValue) {
          lookupLockRef.current = true;
          setCameraState("paused");
          setLookupState("error");
          setLookupErrorMessage(QR_ERROR_MESSAGES.lookupValidationFailed);
          setLookupResult(null);
          setLastScannedValue(null);
          return;
        }

        lookupLockRef.current = true;
        setLastScannedValue(qrCodeValue);
        setLookupState("pending");
        setLookupErrorMessage(null);
        setLookupResult(null);
        setCameraState("paused");

        try {
          scanner.pause(true);
        } catch {
          // The controller can already be paused when the lookup starts.
        }

        try {
          const response = await apiClient.post<QrLookupData>(API_PATHS.qrLookup, {
            body: {
              qrCodeValue
            }
          });

          if (isCancelled) {
            return;
          }

          setLookupResult(response.data);
          setLookupState("success");
        } catch (error) {
          if (isCancelled) {
            return;
          }

          setLookupErrorMessage(
            getApiErrorDisplayMessage(error, {
              codeMessages: QR_LOOKUP_ERROR_MESSAGE_OVERRIDES,
              fallbackMessage: QR_ERROR_MESSAGES.lookupFailed
            })
          );
          setLookupState("error");
        }
      })
      .then(() => {
        if (!isCancelled) {
          setCameraState((current) => (current === "starting" ? "ready" : current));
        }
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setScannerErrorMessage(
          getApiErrorDisplayMessage(error, {
            fallbackMessage: QR_ERROR_MESSAGES.cameraUnavailable
          })
        );
        setCameraState("error");
      });

    return () => {
      isCancelled = true;

      void scanner
        .stop()
        .catch(() => undefined)
        .finally(() => {
          try {
            scanner.clear();
          } catch {
            // Ignore cleanup errors during route changes.
          }
        });
    };
  }, [apiClient, scanSessionId, scannerContainerId]);

  const scannerStatusMessage = getScannerStatusMessage(cameraState, lookupState);
  const isLookupResultVisible = lookupState === "success" && lookupResult !== null;

  return (
    <section className="management-page qr-page" aria-labelledby="qr-page-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div>
          <h1 id="qr-page-title">QR読み取り</h1>
          <p className="management-page__lead">
            端末カメラで QR を読み取り、商品確認の結果を表示します。
          </p>
        </div>
        {launchContext ? (
          <p className="management-page__sync" role="status">
            {`商品詳細から開いた商品: ${launchContext.productId}`}
          </p>
        ) : null}
      </div>

      <section className="management-page__section" aria-labelledby="qr-scanner-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="qr-scanner-title" className="management-page__section-title">
              カメラ読み取り
            </h2>
            <p className="management-page__section-summary">
              QRコードを枠内に合わせると自動で照合します。
            </p>
          </div>
        </div>
        {cameraState === "error" ? (
          <ScreenErrorState
            message={scannerErrorMessage ?? QR_ERROR_MESSAGES.cameraUnavailable}
            onRetry={handleRetry}
          />
        ) : (
          <article className="management-card qr-page__scanner-card">
            <div className="qr-page__scanner-frame">
              <div id={scannerContainerId} className="qr-page__scanner-target" />
              <p className="qr-page__scanner-status" role="status">
                {scannerStatusMessage}
              </p>
            </div>
            <p className="management-form__hint">
              読み取り後は結果が下に表示されます。再試行でスキャンをやり直せます。
            </p>
          </article>
        )}
      </section>

      <section className="management-page__section" aria-labelledby="qr-result-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="qr-result-title" className="management-page__section-title">
              読み取り結果
            </h2>
            <p className="management-page__section-summary">
              照合した商品情報と販売済更新可否を表示します。
            </p>
          </div>
        </div>
        {lookupState === "idle" ? (
          <ScreenEmptyState message="QRコードを読み取ると結果が表示されます。" />
        ) : null}
        {lookupState === "pending" ? (
          <ScreenLoadingState message="読み取り結果を確認しています..." />
        ) : null}
        {lookupState === "error" ? (
          <ScreenErrorState
            message={lookupErrorMessage ?? QR_ERROR_MESSAGES.lookupFailed}
            onRetry={handleRetry}
          />
        ) : null}
        {isLookupResultVisible ? (
          <article
            className={`management-card qr-page__result-card ${
              lookupResult.canSell ? "is-success" : "is-error"
            }`}
          >
            <div className="management-card__header">
              <div>
                <p className="management-card__subtitle">
                  {lookupResult.canSell ? "更新可能" : "更新不可"}
                </p>
                <h3 className="management-card__title">
                  {lookupResult.productId ? lookupResult.name : "該当する商品が見つかりません"}
                </h3>
              </div>
            </div>
            <dl className="management-card__details">
              <div>
                <dt>読み取ったQR値</dt>
                <dd>{formatLookupDetail(lastScannedValue)}</dd>
              </div>
              <div>
                <dt>判定</dt>
                <dd>{lookupResult.canSell ? "販売済更新可能" : "販売済更新不可"}</dd>
              </div>
              <div>
                <dt>商品ID</dt>
                <dd>{formatLookupDetail(lookupResult.productId)}</dd>
              </div>
              <div>
                <dt>商品名</dt>
                <dd>{formatLookupDetail(lookupResult.name)}</dd>
              </div>
              <div>
                <dt>現在ステータス</dt>
                <dd>
                  {lookupResult.status
                    ? PRODUCT_STATUS_LABELS[lookupResult.status]
                    : "未取得"}
                </dd>
              </div>
            </dl>
            <div
              className={
                lookupResult.canSell
                  ? "management-page__notice is-success"
                  : "management-page__notice is-error"
              }
              role={lookupResult.canSell ? "status" : "alert"}
            >
              <p>{lookupResult.message}</p>
            </div>
            <div className="management-card__actions">
              <button
                className="secondary-button"
                type="button"
                onClick={handleRetry}
              >
                再試行
              </button>
            </div>
          </article>
        ) : null}
      </section>
    </section>
  );
}
