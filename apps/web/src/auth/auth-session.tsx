/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";

export const SESSION_EXPIRED_MESSAGE =
  "セッションが切れました。再度ログインしてください。";
export const AUTH_FORBIDDEN_MESSAGE = "この操作は実行できません。";

type IdTokenProvider = () => Promise<string | null>;

interface AuthSessionContextValue {
  authNotice: string | null;
  clearAuthNotice: () => void;
  getIdToken: () => Promise<string | null>;
  setAuthNotice: (message: string | null) => void;
  setIdTokenProvider: (provider: IdTokenProvider | null) => void;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const idTokenProviderRef = useRef<IdTokenProvider | null>(null);

  const clearAuthNotice = useCallback(() => {
    setAuthNotice(null);
  }, []);

  const setIdTokenProvider = useCallback((provider: IdTokenProvider | null) => {
    idTokenProviderRef.current = provider;
  }, []);

  const getIdToken = useCallback(async () => {
    if (!idTokenProviderRef.current) {
      return null;
    }

    return idTokenProviderRef.current();
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      authNotice,
      clearAuthNotice,
      getIdToken,
      setAuthNotice,
      setIdTokenProvider
    }),
    [authNotice, clearAuthNotice, getIdToken, setIdTokenProvider]
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }

  return context;
}
