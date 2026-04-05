# Docker ローカル開発構成

この構成は、以下をローカルで同時起動するための最小セットです。

- `web`: Vite 開発サーバー
- `api`: Express API
- `firebase-emulators`: Auth / Firestore / Storage Emulator

## ねらい

- 日常開発で重くなりやすい Hosting Emulator は最初は外す
- 本番設計（Hosting + Cloud Run）は維持しつつ、ローカル開発は `web + api + emulator` に寄せる
- ブラウザからは `localhost` 公開ポートを見る
- API コンテナからは Docker Compose のサービス名で Emulator に接続する

## 使い方

```bash
cp .env.docker.example .env.docker
docker compose up --build
```

## 公開ポート

- Web: `http://localhost:5173`
- API: `http://localhost:8080`
- Firebase Emulator UI: `http://localhost:4000`
- Auth Emulator: `localhost:9099`
- Firestore Emulator: `localhost:8081`
- Storage Emulator: `localhost:9199`

## 想定している前提

- ルートに `package.json` があり、npm workspaces を使っている
- `apps/web`, `apps/api`, `packages/shared` が存在する
- Web は `npm run dev --workspace apps/web`
- API は `npm run dev --workspace apps/api`

## ずれそうな点

### 1. パッケージ管理が npm workspaces ではない

pnpm / yarn / 各 app 個別 package.json 運用の場合は、`Dockerfile` と `docker-compose.yml` の `command` を合わせて変更してください。

### 2. API のエントリポイント

`apps/api/dist/index.js` を想定しています。実際のビルド出力に合わせて `apps/api/Dockerfile` の production `CMD` は調整してください。

### 3. Firebase Web SDK 設定

`.env.docker.example` の `VITE_FIREBASE_*` は実プロジェクト値へ置き換えてください。

### 4. フロントから Firestore / Storage を直接触らない前提

設計どおり、業務データ更新は API 経由です。Web 側で必須なのは主に Auth Emulator 接続です。

## この構成でやっていないこと

- Firebase Hosting Emulator の Compose 化
- seed データ投入スクリプト
- Cloud Run 本番用の完全な CI/CD

最初はここまでで十分です。Hosting Emulator は必要になってから追加で問題ありません。
