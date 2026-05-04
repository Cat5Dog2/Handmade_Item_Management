import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES } from "../messages/display-messages";
import { LoginRecordError } from "./auth-provider";
import { LoginRoute } from "./login-page";

const authHooks = vi.hoisted(() => ({
  clearAuthNotice: vi.fn(),
  getIdToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  setAuthNotice: vi.fn(),
  setIdTokenProvider: vi.fn(),
  useAppAuth: vi.fn(),
  useAuthSession: vi.fn()
}));

vi.mock("./auth-provider", async () => {
  const actual = await vi.importActual<typeof import("./auth-provider")>(
    "./auth-provider"
  );

  return {
    ...actual,
    useAppAuth: authHooks.useAppAuth
  };
});

vi.mock("./auth-session", async () => {
  const actual = await vi.importActual<typeof import("./auth-session")>(
    "./auth-session"
  );

  return {
    ...actual,
    useAuthSession: authHooks.useAuthSession
  };
});

function renderLoginRoute() {
  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={["/login"]}
    >
      <LoginRoute />
    </MemoryRouter>
  );
}

function setDefaultHooks({
  isAuthReady = true,
  isAuthenticated = false,
  isLoginInProgress = false
}: {
  isAuthReady?: boolean;
  isAuthenticated?: boolean;
  isLoginInProgress?: boolean;
} = {}) {
  authHooks.useAppAuth.mockReturnValue({
    authUser: null,
    isAuthenticated,
    isAuthReady,
    isLoginInProgress,
    login: authHooks.login,
    logout: authHooks.logout,
    sendPasswordResetEmail: authHooks.sendPasswordResetEmail
  });

  authHooks.useAuthSession.mockReturnValue({
    authNotice: null,
    clearAuthNotice: authHooks.clearAuthNotice,
    getIdToken: authHooks.getIdToken,
    setAuthNotice: authHooks.setAuthNotice,
    setIdTokenProvider: authHooks.setIdTokenProvider
  });
}

describe("LoginRoute", () => {
  beforeEach(() => {
    authHooks.clearAuthNotice.mockReset();
    authHooks.getIdToken.mockReset();
    authHooks.login.mockReset();
    authHooks.logout.mockReset();
    authHooks.sendPasswordResetEmail.mockReset();
    authHooks.setAuthNotice.mockReset();
    authHooks.setIdTokenProvider.mockReset();
    authHooks.useAppAuth.mockReset();
    authHooks.useAuthSession.mockReset();
  });

  it("shows the auth status page while auth is not ready", () => {
    setDefaultHooks({
      isAuthReady: false
    });

    renderLoginRoute();

    expect(
      screen.getByRole("heading", { name: "確認中" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "ログイン" })
    ).not.toBeInTheDocument();
  });

  it("shows validation errors when the login form is submitted empty", async () => {
    setDefaultHooks();

    renderLoginRoute();

    const form = document.querySelector("form");
    expect(form).not.toBeNull();

    if (!form) {
      throw new Error("Login form was not rendered.");
    }

    fireEvent.submit(form);

    expect(
      await screen.findByText("メールアドレスを入力してください。")
    ).toBeInTheDocument();
    expect(screen.getByText("パスワードを入力してください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeDisabled();
  });

  it("shows the login record failure message when login record submission fails", async () => {
    authHooks.login.mockRejectedValue(new LoginRecordError());
    setDefaultHooks();

    renderLoginRoute();

    fireEvent.input(screen.getByLabelText("メールアドレス"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.blur(screen.getByLabelText("メールアドレス"));
    fireEvent.input(screen.getByLabelText("パスワード"), {
      target: { value: "password123" }
    });
    fireEvent.blur(screen.getByLabelText("パスワード"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(authHooks.login).toHaveBeenCalledWith({
        email: "owner@example.com",
        password: "password123"
      });
    });

    expect(authHooks.login).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "password123"
    });
    expect(authHooks.clearAuthNotice).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(AUTH_MESSAGES.loginRecordFailed)
    ).toBeInTheDocument();
  });
});
