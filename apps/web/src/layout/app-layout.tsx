import { useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate
} from "react-router-dom";
import { useAppAuth } from "../auth/auth-provider";
import { AuthStatusPage } from "../auth/login-page";
import { APP_NAME } from "../messages/display-messages";
import {
  backEnabledPaths,
  findProtectedRoute,
  protectedRoutes,
  type ProtectedRouteDefinition
} from "../routes/protected-routes";

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
              isActive
                ? "app-navigation__link is-active"
                : "app-navigation__link"
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

export function RequireAuthenticatedRoute() {
  const { isAuthenticated, isAuthReady, isLoginInProgress } = useAppAuth();

  if (!isAuthReady || isLoginInProgress) {
    return <AuthStatusPage />;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return <ProtectedLayout />;
}

export function WorkspacePage({
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
