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
import { useAuthSession } from "./auth/auth-session";
import { AppProviders } from "./providers/app-providers";

interface ProtectedRouteDefinition {
  navLabel?: string;
  path: string;
  summary: string;
  title: string;
}

const APP_NAME = "Handmade Item Management";

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
  "/products/:productId/tasks"
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
  const { authNotice } = useAuthSession();

  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="auth-panel__brand">{APP_NAME}</p>
        <h1 id="login-title">ログイン</h1>
        {authNotice ? (
          <p className="auth-panel__notice" role="alert">
            {authNotice}
          </p>
        ) : null}
        <p className="auth-panel__summary">
          本人アカウントで続行し、ダッシュボードから一日の流れを始めます。
        </p>
      </section>
    </main>
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
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          {protectedRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <WorkspacePage summary={route.summary} title={route.title} />
              }
            />
          ))}
        </Route>
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    </AppProviders>
  );
}
