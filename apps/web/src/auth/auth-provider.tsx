/* eslint-disable react-refresh/only-export-components */
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import type { User } from "firebase/auth";
import { useAuthSession } from "./auth-session";
import {
  sendPasswordReset,
  signInWithEmail,
  signOutUser,
  subscribeToAuthChanges
} from "./firebase-auth-client";

interface LoginInput {
  email: string;
  password: string;
}

interface LogoutOptions {
  clearNotice?: boolean;
}

interface AuthContextValue {
  authUser: User | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { clearAuthNotice, setIdTokenProvider } = useAuthSession();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setAuthUser(user);
      setIdTokenProvider(user ? () => user.getIdToken() : null);
      setIsAuthReady(true);
    });

    return unsubscribe;
  }, [setIdTokenProvider]);

  const login = useCallback(
    async ({ email, password }: LoginInput) => {
      const credential = await signInWithEmail(email, password);

      clearAuthNotice();
      setAuthUser(credential.user);
      setIdTokenProvider(() => credential.user.getIdToken());
      setIsAuthReady(true);
    },
    [clearAuthNotice, setIdTokenProvider]
  );

  const logout = useCallback(
    async (options: LogoutOptions = {}) => {
      if (options.clearNotice ?? true) {
        clearAuthNotice();
      }

      setAuthUser(null);
      setIdTokenProvider(null);
      setIsAuthReady(true);
      queryClient.clear();

      await signOutUser();
    },
    [clearAuthNotice, queryClient, setIdTokenProvider]
  );

  const sendPasswordResetEmail = useCallback((email: string) => {
    return sendPasswordReset(email);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authUser,
      isAuthenticated: authUser !== null,
      isAuthReady,
      login,
      logout,
      sendPasswordResetEmail
    }),
    [authUser, isAuthReady, login, logout, sendPasswordResetEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAppAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAppAuth must be used within AuthProvider");
  }

  return context;
}
