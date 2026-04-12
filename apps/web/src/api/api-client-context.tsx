/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AUTH_FORBIDDEN_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  useAuthSession
} from "../auth/auth-session";
import { createApiClient, type ApiClient } from "./api-client";

const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiClientProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const { getIdToken, setAuthNotice } = useAuthSession();

  const apiClient = useMemo(
    () =>
      createApiClient({
        getIdToken,
        onUnauthorized: () => {
          setAuthNotice(SESSION_EXPIRED_MESSAGE);
          navigate("/login", { replace: true });
        },
        onForbidden: () => {
          setAuthNotice(AUTH_FORBIDDEN_MESSAGE);
          navigate("/login", { replace: true });
        }
      }),
    [getIdToken, navigate, setAuthNotice]
  );

  return (
    <ApiClientContext.Provider value={apiClient}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient() {
  const context = useContext(ApiClientContext);

  if (!context) {
    throw new Error("useApiClient must be used within ApiClientProvider");
  }

  return context;
}
