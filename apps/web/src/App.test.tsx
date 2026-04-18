import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";

type MockAuthUser = {
  email: string;
  getIdToken: () => Promise<string>;
  uid: string;
};

const authMock = vi.hoisted(() => {
  let currentUser: MockAuthUser | null = null;
  const listeners = new Set<(user: MockAuthUser | null) => void>();

  const notify = () => {
    listeners.forEach((listener) => {
      listener(currentUser);
    });
  };

  return {
    sendPasswordReset: vi.fn(async () => undefined),
    signInWithEmail: vi.fn(async (email: string) => {
      currentUser = {
        email,
        getIdToken: async () => "test-id-token",
        uid: "test-user"
      };
      notify();

      return {
        user: currentUser
      };
    }),
    signOutUser: vi.fn(async () => {
      currentUser = null;
      notify();
    }),
    subscribeToAuthChanges: vi.fn((callback: (user: MockAuthUser | null) => void) => {
      listeners.add(callback);
      callback(currentUser);

      return () => {
        listeners.delete(callback);
      };
    }),
    setUser(user: MockAuthUser | null) {
      currentUser = user;
      notify();
    },
    reset() {
      currentUser = null;
      listeners.clear();
      this.sendPasswordReset.mockClear();
      this.signInWithEmail.mockClear();
      this.signOutUser.mockClear();
      this.subscribeToAuthChanges.mockClear();
    }
  };
});

const fetchMock = vi.hoisted(() =>
  vi.fn(async (input: unknown, init?: unknown) => {
    void input;
    void init;

    return new Response(JSON.stringify({ data: { recorded: true } }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 201
    });
  })
);

vi.mock("./auth/firebase-auth-client", () => ({
  sendPasswordReset: authMock.sendPasswordReset,
  signInWithEmail: authMock.signInWithEmail,
  signOutUser: authMock.signOutUser,
  subscribeToAuthChanges: authMock.subscribeToAuthChanges
}));

function renderApp(initialEntry: string) {
  render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={[initialEntry]}
    >
      <App />
    </MemoryRouter>
  );
}

describe("App routing", () => {
  beforeEach(() => {
    authMock.reset();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders the login route and protects unauthenticated routes", async () => {
    renderApp("/dashboard");

    expect(screen.getByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "主要画面" })
    ).not.toBeInTheDocument();
  });

  it("renders the dashboard route inside the shared app layout for authenticated users", () => {
    authMock.setUser({
      email: "owner@example.com",
      getIdToken: async () => "test-id-token",
      uid: "owner-user"
    });
    renderApp("/dashboard");

    expect(
      screen.getByRole("heading", { name: "ダッシュボード" })
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主要画面" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ダッシュボード" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });

  it("keeps product detail routes inside the protected workspace shell", () => {
    authMock.setUser({
      email: "owner@example.com",
      getIdToken: async () => "test-id-token",
      uid: "owner-user"
    });
    renderApp("/products/HM-000001/edit");

    expect(screen.getByRole("heading", { name: "商品編集" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品一覧" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("renders the product create route inside the protected workspace shell", async () => {
    authMock.setUser({
      email: "owner@example.com",
      getIdToken: async () => "test-id-token",
      uid: "owner-user"
    });
    renderApp("/products/new");

    expect(await screen.findByLabelText("商品名")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登録する" })).toBeInTheDocument();
  });

  it("logs in and navigates to the dashboard", async () => {
    renderApp("/login");

    const emailInput = screen.getByLabelText("メールアドレス");
    const passwordInput = screen.getByLabelText("パスワード");
    const submitButton = screen.getByRole("button", { name: "ログイン" });

    fireEvent.input(emailInput, {
      target: { value: "owner@example.com" }
    });
    fireEvent.blur(emailInput);
    fireEvent.input(passwordInput, {
      target: { value: "password123" }
    });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(emailInput).toHaveValue("owner@example.com");
      expect(passwordInput).toHaveValue("password123");
      expect(submitButton).toBeEnabled();
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authMock.signInWithEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "password123"
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const loginRecordRequest = fetchMock.mock.calls[0];
    expect(loginRecordRequest).toBeDefined();
    expect(new URL(String(loginRecordRequest?.[0])).pathname).toBe(
      "/api/auth/login-record"
    );
    const requestInit = loginRecordRequest?.[1] as
      | { headers?: Record<string, string> }
      | undefined;
    expect(new Headers(requestInit?.headers).get("Authorization")).toBe(
      "Bearer test-id-token"
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "ダッシュボード" })
      ).toBeInTheDocument();
    });
  });

  it("opens the password reset dialog with the current email value", async () => {
    renderApp("/login");

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: "パスワードを再設定する" }));

    const dialog = await screen.findByRole("dialog", { name: "パスワード再設定" });
    const dialogEmailInput = within(dialog).getByLabelText("メールアドレス");
    expect(dialogEmailInput).toHaveValue("owner@example.com");

    fireEvent.click(within(dialog).getByRole("button", { name: "送信" }));


    await waitFor(() => {
      expect(
        screen.getByText("パスワード再設定メールを送信しました。")
      ).toBeInTheDocument();
    });
    expect(authMock.sendPasswordReset).toHaveBeenCalledWith("owner@example.com");
  });

  it("logs out from protected screens", async () => {
    authMock.setUser({
      email: "owner@example.com",
      getIdToken: async () => "test-id-token",
      uid: "owner-user"
    });
    renderApp("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    });
    expect(authMock.signOutUser).toHaveBeenCalledTimes(1);
  });
});
