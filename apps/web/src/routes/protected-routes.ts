import { matchPath } from "react-router-dom";

export interface ProtectedRouteDefinition {
  navLabel?: string;
  path: string;
  summary: string;
  title: string;
}

export const protectedRoutes: ProtectedRouteDefinition[] = [
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

export const backEnabledPaths = new Set([
  "/products/new",
  "/products/:productId",
  "/products/:productId/edit",
  "/products/:productId/tasks",
  "/customers/new",
  "/customers/:customerId",
  "/customers/:customerId/edit",
  "/qr"
]);

export function findProtectedRoute(pathname: string) {
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
