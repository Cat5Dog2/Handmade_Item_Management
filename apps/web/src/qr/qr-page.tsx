import type {
  CustomerListData,
  CustomerListItem,
  QrLookupData,
  QrSellData,
  QrSellInput
} from "@handmade/shared";
import {
  API_PATHS,
  PRODUCT_STATUS_LABELS
} from "@handmade/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent
} from "react";
import { useLocation } from "react-router-dom";
import { getApiErrorDisplayMessage } from "../api/api-error-display";
import { useApiClient } from "../api/api-client-context";
import { queryKeys } from "../api/query-keys";
import {
  ScreenEmptyState,
  ScreenErrorState,
  ScreenLoadingState
} from "../components/screen-states";
import {
  APP_NAME,
  QR_ERROR_MESSAGES,
  QR_LOOKUP_ERROR_MESSAGE_OVERRIDES,
  QR_SELL_ERROR_MESSAGES,
  QR_SELL_ERROR_MESSAGE_OVERRIDES,
  QR_SELL_SUCCESS_MESSAGES
} from "../messages/display-messages";
import { createQrScannerController } from "./qr-scanner-adapter";

interface QrLaunchContext {
  productId: string;
  qrCodeValue: string;
}

type CameraState = "starting" | "ready" | "paused" | "error";
type LookupState = "idle" | "pending" | "success" | "error";

const customerSelectQuery = {
  page: 1,
  pageSize: 100,
  sortBy: "name",
  sortOrder: "asc"
} as const;
const scannerLayoutRetryLimit = 10;

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

  if (cameraState === "error") {
    return "カメラを確認できません。権限や接続を確認してください。";
  }

  if (cameraState === "ready") {
    return "QRコードを画面にかざしてください。";
  }

  if (cameraState === "paused" && lookupState === "pending") {
    return "読み取り結果を確認しています...";
  }

  if (cameraState === "paused" && lookupState === "success") {
    return "QR読み取り成功。結果を確認してください。";
  }

  return "新しいQR読み取りを開始できます。";
}

function getScannerStateLabel(cameraState: CameraState, lookupState: LookupState) {
  if (cameraState === "starting") {
    return "起動中";
  }

  if (cameraState === "ready") {
    return "読み取り中";
  }

  if (cameraState === "paused" && lookupState === "pending") {
    return "照合中";
  }

  if (cameraState === "paused" && lookupState === "success") {
    return "読み取り成功";
  }

  if (cameraState === "paused") {
    return "一時停止中";
  }

  return "確認不可";
}

function formatLookupDetail(value: string | null) {
  return value ?? "未設定";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ja-JP");
}

function getSelectedCustomerLabel(
  customers: CustomerListItem[],
  selectedCustomerId: string
) {
  if (!selectedCustomerId) {
    return "未選択";
  }

  return customers.find((customer) => customer.customerId === selectedCustomerId)?.name ?? "未選択";
}

function buildQrSellInput(
  productId: string,
  selectedCustomerId: string
): QrSellInput {
  const body: QrSellInput = {
    productId
  };

  if (selectedCustomerId) {
    body.customerId = selectedCustomerId;
  }

  return body;
}

export function QrPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const location = useLocation();
  const scannerContainerId = useId().replace(/:/g, "-");
  const customerSelectId = useId().replace(/:/g, "-");
  const sellDialogTitleId = useId().replace(/:/g, "-");
  const lookupLockRef = useRef(false);
  const launchContext = isQrLaunchContext(location.state) ? location.state : null;

  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupResult, setLookupResult] = useState<QrLookupData | null>(null);
  const [sellResult, setSellResult] = useState<QrSellData | null>(null);
  const [lookupErrorMessage, setLookupErrorMessage] = useState<string | null>(null);
  const [sellErrorMessage, setSellErrorMessage] = useState<string | null>(null);
  const [scannerErrorMessage, setScannerErrorMessage] = useState<string | null>(
    null
  );
  const [lastScannedValue, setLastScannedValue] = useState<string | null>(null);
  const [scanSessionId, setScanSessionId] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);

  const isLookupResultVisible = lookupState === "success" && lookupResult !== null;
  const isSellActionAvailable =
    isLookupResultVisible && lookupResult.canSell && sellResult === null;

  const customersQuery = useQuery({
    enabled: isSellActionAvailable,
    queryKey: queryKeys.customers.list(customerSelectQuery),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<CustomerListData>(API_PATHS.customers, {
        query: customerSelectQuery,
        signal
      });

      return response.data;
    }
  });

  const availableCustomers = customersQuery.data?.items ?? [];
  const selectedCustomerLabel = getSelectedCustomerLabel(
    availableCustomers,
    selectedCustomerId
  );

  const resetSellFlow = useCallback(() => {
    setSellResult(null);
    setSellErrorMessage(null);
    setSelectedCustomerId("");
    setIsSellDialogOpen(false);
  }, []);

  const handleRetry = useCallback(() => {
    lookupLockRef.current = false;
    setCameraState("starting");
    setLookupState("idle");
    setLookupResult(null);
    setLookupErrorMessage(null);
    setLastScannedValue(null);
    setScannerErrorMessage(null);
    resetSellFlow();
    setScanSessionId((current) => current + 1);
  }, [resetSellFlow]);

  const refreshQrRelatedQueries = useCallback(
    async (productId: string, customerId: string | null) => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.root
        }),
        queryClient.invalidateQueries({
          queryKey: ["products", "list"]
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(productId)
        })
      ];

      if (customerId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["customers", "list"]
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.customers.detail(customerId)
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.customers.purchases(customerId)
          })
        );
      }

      await Promise.all(invalidations);
    },
    [queryClient]
  );

  const sellProductMutation = useMutation({
    mutationFn: async () => {
      if (!lookupResult?.productId) {
        throw new Error("Product ID is missing.");
      }

      const response = await apiClient.post<
        QrSellData,
        undefined,
        QrSellInput
      >(API_PATHS.qrSell, {
        body: buildQrSellInput(lookupResult.productId, selectedCustomerId)
      });

      return response.data;
    },
    onError: (error) => {
      setSellErrorMessage(
        getApiErrorDisplayMessage(error, {
          codeMessages: QR_SELL_ERROR_MESSAGE_OVERRIDES,
          fallbackMessage: QR_SELL_ERROR_MESSAGES.sellFailed
        })
      );
    },
    onSuccess: async (data) => {
      setSellErrorMessage(null);
      setIsSellDialogOpen(false);
      setSellResult(data);
      setSelectedCustomerId("");
      await refreshQrRelatedQueries(data.productId, data.soldCustomerId);
    }
  });

  useEffect(() => {
    let isCancelled = false;
    let scannerStartFrameId: number | null = null;
    const scanner = createQrScannerController(scannerContainerId);
    lookupLockRef.current = false;
    setCameraState("starting");
    setScannerErrorMessage(null);

    const startScanner = () => {
      if (isCancelled) {
        return;
      }

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
            resetSellFlow();
            return;
          }

          lookupLockRef.current = true;
          setLastScannedValue(qrCodeValue);
          setLookupState("pending");
          setLookupErrorMessage(null);
          setLookupResult(null);
          resetSellFlow();
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
    };

    const scheduleScannerStart = (remainingRetries: number) => {
      if (isCancelled) {
        return;
      }

      const scannerElement = document.getElementById(scannerContainerId);
      const hasLayout =
        scannerElement !== null &&
        scannerElement.clientWidth > 0 &&
        scannerElement.clientHeight > 0;

      if (hasLayout || remainingRetries <= 0) {
        startScanner();
        return;
      }

      scannerStartFrameId = window.requestAnimationFrame(() => {
        scheduleScannerStart(remainingRetries - 1);
      });
    };

    scannerStartFrameId = window.requestAnimationFrame(() => {
      scheduleScannerStart(scannerLayoutRetryLimit);
    });

    return () => {
      isCancelled = true;
      if (scannerStartFrameId !== null) {
        window.cancelAnimationFrame(scannerStartFrameId);
      }
      const clearScanner = () => {
        try {
          scanner.clear();
        } catch {
          // Ignore cleanup errors during route changes.
        }
      };

      try {
        void scanner.stop().catch(() => undefined).finally(clearScanner);
      } catch {
        clearScanner();
      }
    };
  }, [apiClient, resetSellFlow, scanSessionId, scannerContainerId]);

  const scannerStatusMessage = getScannerStatusMessage(cameraState, lookupState);
  const scannerStateLabel = getScannerStateLabel(cameraState, lookupState);
  const resultStatus = sellResult ? sellResult.status : lookupResult?.status ?? null;
  const resultCanSell = Boolean(!sellResult && lookupResult?.canSell);
  const resultMessage = sellResult
    ? QR_SELL_SUCCESS_MESSAGES.sellSucceeded
    : lookupResult?.message ?? null;
  const resultSummaryTitle = sellResult
    ? "販売済更新完了"
    : resultCanSell
      ? "QR読み取り成功"
      : lookupResult?.productId
        ? "QR読み取り完了"
        : "読み取り結果を確認してください";
  const resultSummaryMessage = sellResult
    ? QR_SELL_SUCCESS_MESSAGES.sellSucceeded
    : resultCanSell
      ? "商品情報を確認できました。販売済更新に進めます。"
      : resultMessage;
  const resultSubtitle = sellResult
    ? "販売済更新完了"
    : lookupResult?.canSell
      ? "販売済更新可能"
      : "販売済更新不可";
  const resultToneClass = resultCanSell || Boolean(sellResult) ? "is-success" : "is-error";
  const resultRole = resultCanSell || Boolean(sellResult) ? "status" : "alert";

  const handleOpenSellDialog = () => {
    setSellErrorMessage(null);
    setIsSellDialogOpen(true);
  };

  const handleCloseSellDialog = () => {
    if (sellProductMutation.isPending) {
      return;
    }

    setIsSellDialogOpen(false);
    setSellErrorMessage(null);
  };

  const handleCustomerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedCustomerId(event.target.value);
    setSellErrorMessage(null);
  };

  const handleSellConfirm = async () => {
    if (!isSellActionAvailable) {
      return;
    }

    try {
      await sellProductMutation.mutateAsync();
    } catch {
      // The mutation error is surfaced through sellErrorMessage.
    }
  };

  return (
    <section className="management-page qr-page" aria-labelledby="qr-page-title">
      <div className="management-page__header">
        <p className="management-page__eyebrow">{APP_NAME}</p>
        <div>
          <h1 id="qr-page-title">QR読み取り</h1>
          <p className="management-page__lead">
            カメラで QR を読み取り、商品の確認と販売済更新を行います。
          </p>
        </div>
        {launchContext ? (
          <p className="management-page__sync" role="status">
            商品詳細から開きました: {launchContext.productId}
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
              QRコードを画面にかざすと自動で読み取ります。
            </p>
          </div>
        </div>
        <article className="management-card qr-page__scanner-card">
          <div className="qr-page__scanner-frame">
            <div className="qr-page__scanner-toolbar">
              <span className="qr-page__scanner-label">カメラプレビュー</span>
              <span className="qr-page__scanner-badge">{scannerStateLabel}</span>
            </div>
            <div
              id={scannerContainerId}
              className="qr-page__scanner-target"
              role="region"
              aria-label="QRコード読み取り用カメラプレビュー"
            />
            <div className="qr-page__scanner-guide" aria-hidden="true" />
          </div>
          <p className="qr-page__scanner-status" role="status">
            {scannerStatusMessage}
          </p>
          {cameraState === "error" ? (
            <ScreenErrorState
              message={scannerErrorMessage ?? QR_ERROR_MESSAGES.cameraUnavailable}
              onRetry={handleRetry}
            />
          ) : (
            <p className="management-form__hint">
              読み取り後は結果を表示します。再試行でスキャンをやり直せます。
            </p>
          )}
        </article>
      </section>

      <section className="management-page__section" aria-labelledby="qr-result-title">
        <div className="management-page__section-header">
          <div>
            <h2 id="qr-result-title" className="management-page__section-title">
              読み取り結果
            </h2>
            <p className="management-page__section-summary">
              読み取った商品情報と販売済更新の操作を表示します。
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
          <article className={`management-card qr-page__result-card ${resultToneClass}`}>
            <div className={`qr-page__result-summary ${resultToneClass}`} role={resultRole}>
              <span className="qr-page__result-mark" aria-hidden="true">
                {resultCanSell || Boolean(sellResult) ? "OK" : "!"}
              </span>
              <div>
                <p className="qr-page__result-summary-title">{resultSummaryTitle}</p>
                {resultSummaryMessage ? (
                  <p className="qr-page__result-summary-text">{resultSummaryMessage}</p>
                ) : null}
              </div>
            </div>
            <div className="management-card__header">
              <div>
                <p className="management-card__subtitle">{resultSubtitle}</p>
                <h3 className="management-card__title">
                  {lookupResult.productId ? lookupResult.name : "該当する商品が見つかりません"}
                </h3>
              </div>
            </div>
            <dl className="management-card__details">
              <div>
                <dt>読み取り値</dt>
                <dd>{formatLookupDetail(lastScannedValue)}</dd>
              </div>
              <div>
                <dt>現在ステータス</dt>
                <dd>
                  {resultStatus ? PRODUCT_STATUS_LABELS[resultStatus] : "未取得"}
                </dd>
              </div>
              <div>
                <dt>商品ID</dt>
                <dd>{formatLookupDetail(lookupResult.productId)}</dd>
              </div>
              <div>
                <dt>商品名</dt>
                <dd>{formatLookupDetail(lookupResult.name)}</dd>
              </div>
              {sellResult ? (
                <div>
                  <dt>販売済更新日時</dt>
                  <dd>{formatDateTime(sellResult.soldAt)}</dd>
                </div>
              ) : null}
            </dl>
            {isSellActionAvailable ? (
              <div className="management-page__field-group">
                <label className="management-form__label" htmlFor={customerSelectId}>
                  購入者
                </label>
                <select
                  id={customerSelectId}
                  className="management-form__select"
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                  disabled={customersQuery.isPending || sellProductMutation.isPending}
                >
                  <option value="">未選択</option>
                  {availableCustomers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <p className="management-form__hint">
                  {customersQuery.isError
                    ? "購入者一覧を取得できませんでした。未選択のまま更新できます。"
                    : "未選択でも更新できます。"}
                </p>
                <div className="management-card__actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={handleOpenSellDialog}
                  >
                    販売済更新
                  </button>
                  <button className="secondary-button" type="button" onClick={handleRetry}>
                    再読み取り
                  </button>
                </div>
              </div>
            ) : (
              <div className="management-card__actions">
                <button className="secondary-button" type="button" onClick={handleRetry}>
                  再読み取り
                </button>
              </div>
            )}
          </article>
        ) : null}
      </section>

      {isSellDialogOpen ? (
        <div className="app-dialog__backdrop" role="presentation">
          <section
            aria-labelledby={sellDialogTitleId}
            aria-modal="true"
            className="app-dialog"
            role="dialog"
          >
            <h2 id={sellDialogTitleId}>販売済更新確認</h2>
            <p className="app-dialog__summary">
              この商品を販売済みに更新します。内容を確認して確定してください。
            </p>
            <dl className="management-card__details">
              <div>
                <dt>商品名</dt>
                <dd>{formatLookupDetail(lookupResult?.name ?? null)}</dd>
              </div>
              <div>
                <dt>商品ID</dt>
                <dd>{formatLookupDetail(lookupResult?.productId ?? null)}</dd>
              </div>
              <div>
                <dt>現在ステータス</dt>
                <dd>
                  {lookupResult?.status
                    ? PRODUCT_STATUS_LABELS[lookupResult.status]
                    : "未取得"}
                </dd>
              </div>
              <div>
                <dt>購入者</dt>
                <dd>{selectedCustomerLabel}</dd>
              </div>
            </dl>
            {sellErrorMessage ? (
              <div className="management-page__notice is-error" role="alert">
                <p>{sellErrorMessage}</p>
              </div>
            ) : null}
            <div className="app-dialog__actions">
              <button
                className="secondary-button"
                disabled={sellProductMutation.isPending}
                type="button"
                onClick={handleCloseSellDialog}
              >
                キャンセル
              </button>
              <button
                className="primary-button"
                disabled={sellProductMutation.isPending}
                type="button"
                onClick={() => {
                  void handleSellConfirm();
                }}
              >
                販売済に更新
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
