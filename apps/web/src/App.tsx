import { useState } from "react";
import { z } from "zod";
import {
  matchPath,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";
import { LoginRecordError, useAppAuth } from "./auth/auth-provider";
import { useAuthSession } from "./auth/auth-session";
import { CategoryManagementPage } from "./categories/category-management-page";
import { CustomerDetailPage } from "./customers/customer-detail-page";
import { CustomerListPage } from "./customers/customer-list-page";
import { useZodForm } from "./forms/use-zod-form";
import { AppProviders } from "./providers/app-providers";
import { ProductCreatePage } from "./products/product-create-page";
import { ProductListPage } from "./products/product-list-page";
import { TagManagementPage } from "./tags/tag-management-page";

interface ProtectedRouteDefinition {
  navLabel?: string;
  path: string;
  summary: string;
  title: string;
}

const APP_NAME = "Handmade Item Management";
const LOGIN_RECORD_ERROR_MESSAGE =
  "ログイン記録の送信に失敗しました。しばらくしてから再度お試しください。";
const LOGIN_ERROR_MESSAGE = "メールアドレスまたはパスワードが正しくありません。";
const PASSWORD_RESET_ERROR_MESSAGE =
  "パスワード再設定メールを送信できませんでした。入力内容を確認してください。";
const PASSWORD_RESET_SUCCESS_MESSAGE =
  "パスワード再設定メールを送信しました。";

const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください。")
    .email("メールアドレスの形式を確認してください。"),
  password: z.string().min(1, "パスワードを入力してください。")
});

const passwordResetFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください。")
    .email("メールアドレスの形式を確認してください。")
});

const protectedRoutes: ProtectedRouteDefinition[] = [
  {
    path: "/dashboard",
    title: "ダッシュボード",
    summary: "制作状況と販売の流れをまとめて確認します。",
    navLabel: "ダッシュボード"
  },
  {
    path: "/products",
    title: "商品一覧",
    summary: "条件を整えて必要な一点へすばやくたどり着きます。",
    navLabel: "商品一覧"
  },
  {
    path: "/products/new",
    title: "商品登録",
    summary: "新しい一点を登録します。"
  },
  {
    path: "/products/:productId",
    title: "商品詳細",
    summary: "画像、状態、関連タスクをひとつにまとめます。"
  },
  {
    path: "/products/:productId/edit",
    title: "商品編集",
    summary: "販売状況と制作情報を最新の内容へ整えます。"
  },
  {
    path: "/products/:productId/tasks",
    title: "タスク管理",
    summary: "残り作業と納期を整理して進みやすくします。"
  },
  {
    path: "/customers",
    title: "顧客一覧",
    summary: "顧客を検索し、最終購入情報と購入回数を確認します。",
    navLabel: "顧客一覧"
  },
  {
    path: "/customers/new",
    title: "顧客登録",
    summary: "新しい顧客情報を登録します。"
  },
  {
    path: "/customers/:customerId",
    title: "顧客詳細",
    summary: "顧客情報と購入履歴を確認します。"
  },
  {
    path: "/customers/:customerId/edit",
    title: "顧客編集",
    summary: "顧客情報を最新の内容へ整えます。"
  },
  {
    path: "/categories",
    title: "カテゴリ管理",
    summary: "分類の並び順と使い分けを整えます。",
    navLabel: "カテゴリ管理"
  },
  {
    path: "/tags",
    title: "タグ管理",
    summary: "探しやすい切り口をそろえます。",
    navLabel: "タグ管理"
  },
  {
    path: "/qr",
    title: "QR読み取り",
    summary: "読み取り結果から販売済み更新へ進みます。",
    navLabel: "QR読み取り"
  }
];

const backEnabledPaths = new Set([
  "/products/new",
  "/products/:productId",
  "/products/:productId/edit",
  "/products/:productId/tasks",
  "/customers/new",
  "/customers/:customerId",
  "/customers/:customerId/edit"
]);

function findProtectedRoute(pathname: string) {
  return protectedRoutes.find((route) =>
    matchPath(
      {
        path: route.path,
        end: true
      },
      pathname
    )
  );
}

function LoginPage() {
  const { clearAuthNotice, authNotice } = useAuthSession();
  const { login, sendPasswordResetEmail } = useAppAuth();
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passwordResetMessage, setPasswordResetMessage] = useState<
    string | null
  >(null);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(
    null
  );

  const loginForm = useZodForm(loginFormSchema, {
    defaultValues: {
      email: "",
      password: ""
    },
    mode: "onChange"
  });
  const passwordResetForm = useZodForm(passwordResetFormSchema, {
    defaultValues: {
      email: ""
    },
    mode: "onChange"
  });
  const emailValue = loginForm.watch("email");
  const displayedAuthMessage = loginError ?? authNotice;

  const openPasswordResetDialog = () => {
    setPasswordResetError(null);
    setPasswordResetMessage(null);
    passwordResetForm.reset({
      email: emailValue.trim()
    });
    setIsPasswordResetOpen(true);
  };

  const closePasswordResetDialog = () => {
    setPasswordResetError(null);
    setPasswordResetMessage(null);
    setIsPasswordResetOpen(false);
  };

  const handleLogin = loginForm.handleSubmit(async (values) => {
    setLoginError(null);
    clearAuthNotice();

    try {
      await login(values);
      loginForm.reset();
    } catch (error) {
      setLoginError(
        error instanceof LoginRecordError
          ? LOGIN_RECORD_ERROR_MESSAGE
          : LOGIN_ERROR_MESSAGE
      );
    }
  });

  const handlePasswordReset = passwordResetForm.handleSubmit(async (values) => {
    setPasswordResetError(null);
    setPasswordResetMessage(null);

    try {
      await sendPasswordResetEmail(values.email);
      setPasswordResetMessage(PASSWORD_RESET_SUCCESS_MESSAGE);
    } catch {
      setPasswordResetError(PASSWORD_RESET_ERROR_MESSAGE);
    }
  });

  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="auth-panel__brand">{APP_NAME}</p>
        <h1 id="login-title">ログイン</h1>
        {displayedAuthMessage ? (
          <p className="auth-panel__notice" role="alert">
            {displayedAuthMessage}
          </p>
        ) : null}
        <p className="auth-panel__summary">
          本人アカウントで続行し、その日の状態確認から始めます。
        </p>
        <form className="auth-form" onSubmit={handleLogin} noValidate>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="login-email">
              メールアドレス
            </label>
            <input
              {...loginForm.register("email")}
              id="login-email"
              autoComplete="username"
              className="auth-field__input"
              type="email"
            />
            {loginForm.formState.errors.email ? (
              <p className="auth-field__error" role="alert">
                {loginForm.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="login-password">
              パスワード
            </label>
            <input
              {...loginForm.register("password")}
              id="login-password"
              autoComplete="current-password"
              className="auth-field__input"
              type="password"
            />
            {loginForm.formState.errors.password ? (
              <p className="auth-field__error" role="alert">
                {loginForm.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <div className="auth-panel__actions">
            <button
              className="primary-button"
              type="submit"
              disabled={
                !loginForm.formState.isValid || loginForm.formState.isSubmitting
              }
            >
              {loginForm.formState.isSubmitting ? "ログイン中..." : "ログイン"}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={openPasswordResetDialog}
            >
              パスワードを再設定する
            </button>
          </div>
        </form>
      </section>
      {isPasswordResetOpen ? (
        <div className="auth-dialog__backdrop" role="presentation">
          <section
            aria-labelledby="password-reset-title"
            aria-modal="true"
            className="auth-dialog"
            role="dialog"
          >
            <h2 id="password-reset-title">パスワード再設定</h2>
            <p className="auth-dialog__summary">
              登録済みのメールアドレスへ再設定メールを送ります。
            </p>
            {passwordResetMessage ? (
              <p className="auth-dialog__success" role="status">
                {passwordResetMessage}
              </p>
            ) : null}
            {passwordResetError ? (
              <p className="auth-dialog__error" role="alert">
                {passwordResetError}
              </p>
            ) : null}
            <form className="auth-form" onSubmit={handlePasswordReset} noValidate>
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="password-reset-email">
                  メールアドレス
                </label>
                <input
                  {...passwordResetForm.register("email")}
                  id="password-reset-email"
                  autoComplete="email"
                  className="auth-field__input"
                  type="email"
                />
                {passwordResetForm.formState.errors.email ? (
                  <p className="auth-field__error" role="alert">
                    {passwordResetForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className="auth-dialog__actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={passwordResetForm.formState.isSubmitting}
                  onClick={closePasswordResetDialog}
                >
                  閉じる
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    !passwordResetForm.formState.isValid ||
                    passwordResetForm.formState.isSubmitting
                  }
                >
                  {passwordResetForm.formState.isSubmitting ? "送信中..." : "送信"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function AuthStatusPage() {
  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="auth-status-title">
        <p className="auth-panel__brand">{APP_NAME}</p>
        <h1 id="auth-status-title">確認中</h1>
        <p className="auth-panel__summary">
          認証状態を確認しています。少しだけお待ちください。
        </p>
      </section>
    </main>
  );
}

function LoginRoute() {
  const { isAuthenticated, isAuthReady, isLoginInProgress } = useAppAuth();

  if (!isAuthReady || isLoginInProgress) {
    return <AuthStatusPage />;
  }

  if (isAuthenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  return <LoginPage />;
}

function LogoutButton() {
  const navigate = useNavigate();
  const { logout } = useAppAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      className="header-button"
      type="button"
      disabled={isLoggingOut}
      onClick={() => {
        void handleLogout();
      }}
    >
      {isLoggingOut ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}

function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = findProtectedRoute(location.pathname);
  const canGoBack = currentRoute
    ? backEnabledPaths.has(currentRoute.path)
    : false;

  return (
    <header className="app-header">
      <div className="app-header__main">
        {canGoBack ? (
          <button
            className="header-button"
            type="button"
            onClick={() => navigate(-1)}
          >
            戻る
          </button>
        ) : null}
        <div>
          <p className="app-header__brand">{APP_NAME}</p>
          <p className="app-header__title">
            {currentRoute?.title ?? "ワークスペース"}
          </p>
        </div>
        <div className="app-header__actions">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

function AppNavigation() {
  return (
    <nav className="app-navigation" aria-label="主要画面">
      {protectedRoutes
        .filter((route) => route.navLabel)
        .map((route) => (
          <NavLink
            key={route.path}
            className={({ isActive }) =>
              isActive ? "app-navigation__link is-active" : "app-navigation__link"
            }
            end={route.path === "/dashboard"}
            to={route.path}
          >
            {route.navLabel}
          </NavLink>
        ))}
    </nav>
  );
}

function ProtectedLayout() {
  return (
    <div className="app-layout">
      <AppHeader />
      <AppNavigation />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}

function RequireAuthenticatedRoute() {
  const { isAuthenticated, isAuthReady, isLoginInProgress } = useAppAuth();

  if (!isAuthReady || isLoginInProgress) {
    return <AuthStatusPage />;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return <ProtectedLayout />;
}

function WorkspacePage({
  summary,
  title
}: Pick<ProtectedRouteDefinition, "summary" | "title">) {
  return (
    <section className="workspace-page" aria-labelledby="page-title">
      <p className="workspace-page__eyebrow">{APP_NAME}</p>
      <h1 id="page-title">{title}</h1>
      <p className="workspace-page__summary">{summary}</p>
    </section>
  );
}

export default function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/" element={<Navigate replace to="/login" />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<RequireAuthenticatedRoute />}>
          {protectedRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                route.path === "/products" ? (
                  <ProductListPage />
                ) : route.path === "/products/new" ? (
                  <ProductCreatePage />
                ) : route.path === "/customers" ? (
                  <CustomerListPage />
                ) : route.path === "/customers/:customerId" ? (
                  <CustomerDetailPage />
                ) : route.path === "/categories" ? (
                  <CategoryManagementPage />
                ) : route.path === "/tags" ? (
                  <TagManagementPage />
                ) : (
                  <WorkspacePage summary={route.summary} title={route.title} />
                )
              }
            />
          ))}
        </Route>
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    </AppProviders>
  );
}
