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

type NavigationIconName =
  | "categories"
  | "customers"
  | "dashboard"
  | "products"
  | "qr"
  | "tags";

const navPresentationByPath: Record<
  string,
  { icon: NavigationIconName; shortLabel: string }
> = {
  "/categories": {
    icon: "categories",
    shortLabel: "カテゴリ"
  },
  "/customers": {
    icon: "customers",
    shortLabel: "顧客"
  },
  "/dashboard": {
    icon: "dashboard",
    shortLabel: "ホーム"
  },
  "/products": {
    icon: "products",
    shortLabel: "商品"
  },
  "/qr": {
    icon: "qr",
    shortLabel: "QR"
  },
  "/tags": {
    icon: "tags",
    shortLabel: "タグ"
  }
};

function NavigationIcon({ name }: { name: NavigationIconName }) {
  return (
    <svg
      aria-hidden="true"
      className="app-navigation__icon"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {name === "dashboard" ? (
        <>
          <rect height="7" rx="1.5" width="7" x="4" y="4" />
          <rect height="7" rx="1.5" width="7" x="13" y="4" />
          <rect height="7" rx="1.5" width="7" x="4" y="13" />
          <rect height="7" rx="1.5" width="7" x="13" y="13" />
        </>
      ) : null}
      {name === "products" ? (
        <>
          <path d="M7 7h13" />
          <path d="M7 12h13" />
          <path d="M7 17h13" />
          <path d="M4 7h.01" />
          <path d="M4 12h.01" />
          <path d="M4 17h.01" />
        </>
      ) : null}
      {name === "customers" ? (
        <>
          <path d="M16 20c0-2.2-1.8-4-4-4s-4 1.8-4 4" />
          <circle cx="12" cy="9" r="4" />
          <path d="M19 20c0-1.3-.6-2.5-1.6-3.2" />
          <path d="M17 6.3a3 3 0 0 1 0 5.4" />
        </>
      ) : null}
      {name === "categories" ? (
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v6A2.5 2.5 0 0 1 18.5 18h-13A2.5 2.5 0 0 1 3 15.5z" />
      ) : null}
      {name === "tags" ? (
        <>
          <path d="M20 12 12 20 4 12V4h8z" />
          <circle cx="9" cy="9" r="1.2" />
        </>
      ) : null}
      {name === "qr" ? (
        <>
          <rect height="6" width="6" x="4" y="4" />
          <rect height="6" width="6" x="14" y="4" />
          <rect height="6" width="6" x="4" y="14" />
          <path d="M15 15h1.5" />
          <path d="M20 15h-1.5v5" />
          <path d="M14 20h2" />
          <path d="M20 20h.01" />
        </>
      ) : null}
    </svg>
  );
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
      className="footer-logout-button"
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
        <div className="app-header__title-group">
          <p className="app-header__brand">{APP_NAME}</p>
          <p className="app-header__title">
            {currentRoute?.title ?? "ワークスペース"}
          </p>
        </div>
        {canGoBack ? (
          <button
            className="header-button"
            type="button"
            onClick={() => navigate(-1)}
          >
            戻る
          </button>
        ) : null}
      </div>
    </header>
  );
}

function AppNavigation() {
  return (
    <nav className="app-navigation" aria-label="主要画面">
      {protectedRoutes
        .filter(
          (route): route is ProtectedRouteDefinition & { navLabel: string } =>
            Boolean(route.navLabel)
        )
        .map((route) => {
          const presentation = navPresentationByPath[route.path] ?? {
            icon: "dashboard" as const,
            shortLabel: route.navLabel
          };

          return (
            <NavLink
              key={route.path}
              aria-label={route.navLabel}
              className={({ isActive }) =>
                isActive
                  ? "app-navigation__link is-active"
                  : "app-navigation__link"
              }
              end={route.path === "/dashboard"}
              title={route.navLabel}
              to={route.path}
            >
              <NavigationIcon name={presentation.icon} />
              <span className="app-navigation__label app-navigation__label--short">
                {presentation.shortLabel}
              </span>
              <span className="app-navigation__label app-navigation__label--full">
                {route.navLabel}
              </span>
            </NavLink>
          );
        })}
    </nav>
  );
}

function AppFooter() {
  const location = useLocation();

  if (location.pathname !== "/dashboard") {
    return null;
  }

  return (
    <footer className="app-footer">
      <LogoutButton />
    </footer>
  );
}

function ProtectedLayout() {
  return (
    <div className="app-layout">
      <AppHeader />
      <AppNavigation />
      <main className="app-content">
        <Outlet />
        <AppFooter />
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
