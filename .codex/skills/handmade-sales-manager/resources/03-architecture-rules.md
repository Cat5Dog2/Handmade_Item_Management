# アーキテクチャ固定ルール

## Firebase アクセス方針
- フロントから Firestore / Storage へ直接アクセスしない
- 業務データの read/write は必ず API 経由
- フロントで直接使う Firebase は Authentication のみ

## API 方針
- ブラウザからの業務API呼び出しは `/api` に統一
- Firebase ID Token を付与して API を呼び出す
- API は Firebase Admin SDK で検証する
- 認証不要は `GET /api/health` のみ

## 状態管理
- サーバー状態: TanStack Query
- フォーム状態: React Hook Form + Zod
- グローバル状態: 認証情報 + 最小限UI状態のみ
- 商品一覧条件は URL クエリで保持
