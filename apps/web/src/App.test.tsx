import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

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
  it("renders the login route without the main navigation", () => {
    renderApp("/login");

    expect(screen.getByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "主要画面" })
    ).not.toBeInTheDocument();
  });

  it("renders the dashboard route inside the shared app layout", () => {
    renderApp("/dashboard");

    expect(
      screen.getByRole("heading", { name: "ダッシュボード" })
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主要画面" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ダッシュボード" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("keeps product detail routes inside the protected workspace shell", () => {
    renderApp("/products/HM-000001/edit");

    expect(screen.getByRole("heading", { name: "商品編集" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品一覧" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
