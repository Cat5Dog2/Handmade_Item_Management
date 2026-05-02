import { Navigate, Route, Routes } from "react-router-dom";
import { LoginRoute } from "./auth/login-page";
import { CategoryManagementPage } from "./categories/category-management-page";
import { CustomerDetailPage } from "./customers/customer-detail-page";
import { CustomerFormPage } from "./customers/customer-form-page";
import { CustomerListPage } from "./customers/customer-list-page";
import { DashboardPage } from "./dashboard/dashboard-page";
import { RequireAuthenticatedRoute, WorkspacePage } from "./layout/app-layout";
import { ProductCreatePage } from "./products/product-create-page";
import { ProductDetailPage } from "./products/product-detail-page";
import { ProductEditPage } from "./products/product-edit-page";
import { ProductListPage } from "./products/product-list-page";
import { AppProviders } from "./providers/app-providers";
import {
  protectedRoutes,
  type ProtectedRouteDefinition
} from "./routes/protected-routes";
import { TagManagementPage } from "./tags/tag-management-page";

function getProtectedRouteElement(route: ProtectedRouteDefinition) {
  switch (route.path) {
    case "/dashboard":
      return <DashboardPage />;
    case "/products":
      return <ProductListPage />;
    case "/products/new":
      return <ProductCreatePage />;
    case "/products/:productId":
      return <ProductDetailPage />;
    case "/products/:productId/edit":
      return <ProductEditPage />;
    case "/customers":
      return <CustomerListPage />;
    case "/customers/new":
    case "/customers/:customerId/edit":
      return <CustomerFormPage />;
    case "/customers/:customerId":
      return <CustomerDetailPage />;
    case "/categories":
      return <CategoryManagementPage />;
    case "/tags":
      return <TagManagementPage />;
    default:
      return <WorkspacePage summary={route.summary} title={route.title} />;
  }
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
              element={getProtectedRouteElement(route)}
            />
          ))}
        </Route>
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    </AppProviders>
  );
}
