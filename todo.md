# Codex への指示文

以下の TODO を実装用の正本として扱ってください。

## 実行ルール

- 毎回、**依存を満たす未完了タスクを 1つだけ**選んで実行すること
- 実装前に、対象タスクの依存・参照設計書・`In scope / Out of scope` を明記すること
- **設計書にない仕様追加は禁止**
- **依存未解決タスクには着手しない**
- API と UI を同じターンで大きく広げないこと
- 変更は最小差分にとどめること
- タスク完了時は、必ず `Task / Status / Changed files / Checks / Notes / Next` を残すこと
- Done 条件を満たさない場合は完了扱いにしないこと
- 判断不能な場合は推測実装せず、`BLOCKED` として止めること

## 毎ターンの手順

1. Ready Queue から依存を満たす未完了タスクを確認し、**6-0 の番号付き一覧で最上位の 1つ** を選ぶ
2. そのタスクに必要な設計書だけ読む
3. 実装前に着手テンプレートを書く
4. そのタスクの主責務だけを実装する
5. 必要最小限の `lint` / `typecheck` / 関連テストを実行する
6. 実行メモを残し、次タスクを 1つだけ示して終了する

## 着手テンプレート

```md
Task: <TASK-ID>
Depends on:
- ...
Read docs:
- ...
In scope:
- ...
Out of scope:
- ...
Checks planned:
- ...
```

## BLOCKED テンプレート

```md
Task: <TASK-ID>
Status: BLOCKED
Blocked by:
- ...
Reason:
- ...
Needed:
- ...
Next candidate:
- ...
```

## 完了時テンプレート

```md
Task: <TASK-ID>
Status: Done
Changed files:
- ...
Checks:
- ...
Notes:
- ...
Next:
- ...
```

---

# TODO for Codex（1タスク実行最適化版・そのまま実行しやすい版）

## 0. この TODO の使い方

- 本書は、`docs/requirements.md` / `docs/basic_design.md` / `docs/detail_design.md` / `docs/api_specification.md` / `docs/data_design.md` / `docs/screen_design.md` / `docs/implementation-notes.md` / `docs/test_design.md` / `docs/test_cases.md` を前提にした、**Codex 向けの実装タスクリスト**である。
- 目的は、Codex が **1タスクずつ安全に実装し、差分を小さく保ちながら前進できる状態** を作ることにある。
- 1回の実装では、原則として **1つのタスクIDのみ** を完了させる。
- タスク着手時は、必ず **依存タスク** を確認する。
- タスク完了時は、**Done 条件** を満たしたうえで終了する。
- 実装順や着手順が `docs/implementation-notes.md` の推奨順と食い違う場合でも、**仕様の正本は `AGENTS.md` で定めた優先順位に従う**。本 TODO は作業分割と依存関係整理の補助として扱う。

### 0-1. タスク状態

- `[ ]` 未着手
- `[~]` 着手済み（部分実装あり・Done未達）
- `[x]` 完了
- `BLOCKED` 依存待ちまたは設計確認待ち

### 0-1A. Ready Queue の定義

- Ready Queue とは、**状態が `[ ]` で、依存タスクがすべて完了しているタスク群** を指す。
- `[~]` のタスクがある場合は、**新しい `[ ]` タスクを選ぶ前に、6-0 の順序で最上位の `[~]` タスクを再開**する。
- 着手対象が複数ある場合は、**6-0 の推奨実行順一覧で最上位の 1つ** を選ぶ。

### 0-2. Codex の実装ルール

- 既存設計書にない独自仕様を足さない
- まず最小実装で通し、その後に改善する
- API と UI を同時に大きく広げず、**縦切りで小さく完了** させる
- 変更した範囲に応じて、最低限 `lint` / `typecheck` / 関連テストを通す
- 仕様差分が出る場合は、コード先行ではなくドキュメント整合を優先する
- 1タスクで扱う責務はできるだけ 1 つに絞る

### 0-2A. 依存設定ルール

- 商品一覧 / 商品登録 / 商品編集 UI は、カテゴリ管理画面・タグ管理画面ではなく、**カテゴリ一覧API / タグ一覧API** に依存させる
- 管理画面そのものが必要な場合だけ `MASTER-03A` / `MASTER-03B` に依存させる
- **認証必須の業務APIタスクは、原則として `API-BASE-02` に依存させる**
- 設計書に未反映の API 追加が必要な場合は、**先に設計反映タスクを置き、その完了前に実装タスクへ進めない**
- 設計判断が未固定のものは、実装タスクへ混ぜず **判断固定タスク** として先に分離する
- ログ系は、**記録方針の固定** と **各イベント実装** を分ける


### 0-2B. Codex の禁止事項

- 依存未解決のタスクに着手しない
- 1回の実装で **複数タスクを完了扱いにしない**
- 設計書にない仕様を、実装都合だけで追加しない
- 無関係なリファクタ・命名変更・ディレクトリ移動を混ぜない
- API タスクで UI をついでに大きく変更しない
- UI タスクで API 仕様をついでに増やさない
- テストタスク以外で、広範囲のテスト作成まで抱え込まない
- BLOCKED なのに推測実装で前進したことにしない

### 0-3. 完了時に残すもの

各タスク完了時に、少なくとも次を残す。

- Task
- Status
- Changed files
- Checks
- Notes
- Next

### 0-4. Codex の着手前チェック

各タスクに着手する前に、必ず次を確認する。

- [ ] 依存タスクが完了している
- [ ] 対応範囲が 1 タスク分に収まっている
- [ ] 参照すべき設計書を特定している
- [ ] 変更対象ディレクトリが過剰に広がっていない
- [ ] このタスクでやらないことを明確にしている

### 0-5. Codex の終了条件

各タスクは、次を満たした時点で終了する。

- [ ] Done 条件を満たしている
- [ ] 追加で手を広げなくても価値が出る最小実装になっている
- [ ] 変更理由を短く説明できる
- [ ] 次タスクへ渡す前提が整理されている

### 0-6. タスク粒度ルール

この版では、**1 タスク = 1 主責務 = 1 レビューしやすい差分** を原則とする。

- API は、原則として「一覧 / 登録 / 詳細 / 更新 / 削除 / 完了切替」を分ける
- Web は、原則として「表示 / 編集 / 危険操作 / 補助導線」を分ける
- 画像、QR、ログ、テストは、処理種別ごとに分ける
- 1 タスク内で UI と API を同時に大きく変更しない
- 迷った場合は、**さらに小さく分割する**

### 0-7. 各タスクで必ず書く実行メモ

各タスク完了時は、最低限次の形式で結果を残す。

```md
Task: PRODUCT-01
Status: Done
Changed files:
- apps/api/src/...
Checks:
- npm run lint
- npm run typecheck
- 関連テスト
Notes:
- 今回やらなかったこと
Next:
- PRODUCT-02
```


### 0-7A. 着手時に先頭で書く固定テンプレート

各タスクの着手時は、実装前に最低限次の形式で宣言する。

```md
Task: PRODUCT-01
Depends on:
- MASTER-01A
- MASTER-02A
Read docs:
- api_specification.md
- detail_design.md
In scope:
- 今回やること
Out of scope:
- 今回やらないこと
Checks planned:
- npm run lint
- npm run typecheck
```

### 0-7B. BLOCKED 時に書く固定テンプレート

依存未解決、または設計未確定で止まる場合は、推測実装をせず次の形式で止める。

```md
Task: PRODUCT-06B
Status: BLOCKED
Blocked by:
- IMAGE-03A
Reason:
- 依存タスク未完了のため着手不可
Needed:
- 先に IMAGE-03A を完了する
Next candidate:
- PRODUCT-06A
```

### 0-8. Codex の実行アルゴリズム

各ターンでの基本動作は、次の固定手順とする。

1. Ready Queue から **依存を満たす未完了タスク** を確認し、**6-0 の番号付き一覧で最上位の 1つ** を選ぶ
2. そのタスクの **参照設計書だけ** を先に読む
3. `In scope / Out of scope` を 3〜6 行で明確化する
4. そのタスクの主責務だけを実装する
5. 変更範囲に応じて `lint` / `typecheck` / 関連テストを実行する
6. 実行メモを残し、次タスクを 1つだけ示して終了する

補足:
- 依存未解決のタスクには着手しない
- 別タスクの TODO をついでに消化しない
- 迷った場合は「今の差分をさらに小さくできないか」を先に検討する


### 0-8A. 1ターンで許可する変更の上限目安

Codex は、1ターンで次を超えそうならタスク分割を優先する。

- 主要責務 1つまで
- 主変更領域 1〜2領域まで
- 新規エンドポイントは原則 1つまで
- 新規画面は原則 1つまで
- 変更ファイル数が多い場合でも、**レビュー観点は 1つ** に保つ

### 0-8B. 迷ったときの優先順位

判断に迷った場合は、次の順で優先する。

1. 設計書整合
2. 依存順の厳守
3. 最小差分
4. テストしやすさ
5. 将来拡張性

### 0-8C. タスク完了としてはいけない状態

次の状態では、そのタスクを完了扱いにしない。

- 実装は入ったが Done 条件を満たしていない
- 動くが、依存前提を壊している
- 主要分岐の正常系すら確認していない
- 次タスクへ渡す前提が説明できない
- 「ついで実装」が主目的より大きくなっている

### 0-9. タスク種別ごとの参照優先表

| 種別 | 先に読む文書 | 主変更対象 | 最低限の確認 |
|---|---|---|---|
| `BOOT-*` | `implementation-notes.md`, `deployment.md` | ルート設定、workspace、共通設定 | `npm install`, `lint`, `typecheck` |
| `SHARED-*` | `detail_design.md`, `api_specification.md`, `data_design.md` | `packages/shared` | `typecheck`, 共有層テスト |
| `API-BASE-*` | `detail_design.md`, `api_specification.md`, `implementation-notes.md` | `apps/api`, 必要に応じて `packages/shared` | `lint`, `typecheck`, 関連API確認 |
| `WEB-BASE-*` | `screen_design.md`, `detail_design.md`, `implementation-notes.md` | `apps/web`, 必要に応じて `packages/shared` | `lint`, `typecheck`, 関連画面確認 |
| `MASTER-*` | `requirements.md`, `detail_design.md`, `api_specification.md`, `screen_design.md` | APIなら `apps/api`、画面なら `apps/web` | 該当機能の正常系/異常系 |
| `PRODUCT-*` | `requirements.md`, `detail_design.md`, `api_specification.md`, `data_design.md`, `screen_design.md` | APIなら `apps/api`、画面なら `apps/web` | 該当APIまたは画面導線 |
| `TASK-*` | `detail_design.md`, `api_specification.md`, `screen_design.md`, `data_design.md` | APIなら `apps/api`、画面なら `apps/web` | 完了切替/表示条件を重点確認 |
| `IMAGE-*` | `requirements.md`, `detail_design.md`, `api_specification.md`, `data_design.md`, `implementation-notes.md` | `apps/api` または `apps/web` | 枚数/形式/代表画像整合 |
| `DASH-*` | `detail_design.md`, `api_specification.md`, `screen_design.md` | APIなら `apps/api`、画面なら `apps/web` | 集計条件と空状態 |
| `QR-*` | `requirements.md`, `detail_design.md`, `api_specification.md`, `implementation-notes.md`, `screen_design.md` | APIなら `apps/api`、画面なら `apps/web` | lookup / sell / 文言分岐 |
| `LOG-*` | `detail_design.md`, `error-messages.md`, `implementation-notes.md` | `apps/api` または `apps/web` | ログ出力または文言マッピング |
| `TEST-*` | `test_design.md`, `test_cases.md`, 関連設計書 | テストコード | 対象ケースの網羅 |
| `INFRA-*` | `deployment.md`, `backup-and-restore.md`, `firebase.json` | `firebase/`, デプロイ設定, 運用手順 | 反映手順と証跡 |
| `SEC-*` | `implementation-notes.md`, `package-lock.json`, 監査結果 | ルート package / lockfile / 関連 docs | `npm audit`, `lint`, `typecheck`, `test`, `build` |
| `REL-*` | `test_design.md`, `test_cases.md`, `deployment.md`, `backup-and-restore.md` | リリース判定資料 | チェックリスト完了 |

### 0-10. 1タスクで広げすぎないための目安

- 原則として **変更ディレクトリは 1〜2領域まで** に抑える
- 原則として **APIタスクで大きなUI変更をしない**
- 原則として **UIタスクで新しいAPI仕様を増やさない**
- 1タスクで複数エンドポイントをまたぐ場合は、同一主責務かを再確認する
- 1タスクで複数画面をまたぐ場合は、共通導線だけに限定する

### 0-11. タスクを分割すべきサイン

次のいずれかに当てはまる場合は、今のタスクは大きすぎる可能性が高い。

- route / service / repository / UI / test を一度に全部作ろうとしている
- API と Web の両方で 10ファイル以上触れそう
- 正常系だけでなく複数の業務分岐を一気に入れようとしている
- 仕様確認のために 5文書以上を同時に往復している
- 「ついでにこれもやる」が発生している

その場合は、まず **主責務だけ残して他は次タスクへ送る**。


### 0-12. Codex が最後に返す固定フォーマット

各タスクの終了時は、原則として次の順で簡潔に返す。

```md
Task: PRODUCT-01
Status: Done
Changed files:
- apps/api/src/...
Checks:
- npm run lint
- npm run typecheck
Notes:
- 今回やらなかったこと
Next:
- PRODUCT-02
```

補足:
- `Status` は `Done` または `BLOCKED` のみでよい
- `Next` には **1つだけ** 書く
- 未対応事項は `Notes` に寄せ、次タスクの責務を増やしすぎない

---

## 1. 優先順ロードマップ

### Phase A: 土台
1. `BOOT-*` リポジトリ / ワークスペース / 共通設定
2. `SHARED-*` 型・定数・スキーマ
3. `API-BASE-*` API基盤
4. `WEB-BASE-*` Web基盤 + 認証

### Phase B: MVP 中核
5. `MASTER-*` カテゴリ / タグ
6. `PRODUCT-*` 商品一覧 / 登録 / 詳細 / 更新 / 削除
7. `TASK-*` タスク管理
8. `IMAGE-*` 商品画像

### Phase C: 周辺機能
9. `DASH-*` ダッシュボード
10. `QR-*` QR生成 / 読み取り / 販売済更新
11. `LOG-*` operationLogs / エラーマッピング

### Phase D: 仕上げ
12. `TEST-*` 自動テスト
13. `INFRA-*` Firebase / Cloud Run / Hosting
14. `SEC-*` 依存脆弱性の整理
15. `REL-*` リリース前確認

---

## 2. Phase A: 土台

### BOOT-01 モノレポ基本構成を作る
- 状態: [x]
- 優先度: P0
- 依存: なし
- 現状メモ: ルート workspace と `apps/web` / `apps/api` / `packages/shared` の `package.json` は作成済み。
- 対象:
  - `apps/web`
  - `apps/api`
  - `packages/shared`
  - `firebase`
  - ルート `package.json`
- 作業:
  - [ ] npm workspaces を設定する
  - [ ] ルート scripts を作成する
  - [ ] 各 workspace の `package.json` を作成する
- Done:
  - [ ] `npm install` が通る
  - [ ] workspace 解決ができる
- 推奨コミット:
  - `chore: initialize monorepo workspace structure`

### BOOT-02 TypeScript / ESLint / Prettier 基盤を揃える
- 状態: [x]
- 優先度: P0
- 依存: `BOOT-01`
- 現状メモ: ルート `tsconfig.json`・workspace 別 `tsconfig`・ESLint・Prettier 設定を追加し、`lint` / `typecheck` / `test` / `build` の起動確認まで完了。
- 作業:
  - [ ] ルート `tsconfig` を作成する
  - [ ] `apps/web` / `apps/api` / `packages/shared` の tsconfig を分ける
  - [ ] ESLint 設定を追加する
  - [ ] Prettier 設定を追加する
  - [ ] `.gitignore` を整備する
- Done:
  - [ ] `npm run lint` が失敗せず起動する
  - [ ] `npm run typecheck` が失敗せず起動する
- 推奨コミット:
  - `chore: add typescript and lint configuration`

### BOOT-03 環境変数運用を整備する
- 状態: [x]
- 優先度: P0
- 依存: `BOOT-01`
- 現状メモ: `.env.example` に Web/API/Firebase/画像/デプロイ関連の変数整理が入っている。
- 作業:
  - [ ] `.env.example` を最新方針に合わせる
  - [ ] Web 用公開変数を整理する
  - [ ] API 用秘密変数を整理する
  - [ ] ローカルと本番の役割をコメントで明記する
- Done:
  - [ ] `VITE_` 付き変数のみがフロント想定になっている
  - [ ] API 用変数が分離されている
- 推奨コミット:
  - `chore: organize environment variable templates`

### SHARED-01 共通定数を実装する
- 状態: [x]
- 優先度: P0
- 依存: `BOOT-01`
- 現状メモ: 商品ステータス・表示名マップ・API パス定数・エラーコード・日付フォーマットを `packages/shared` に集約済み。
- 作業:
  - [ ] 商品ステータス定数を定義する
  - [ ] ステータス表示名マップを定義する
  - [ ] API パス定数を定義する
  - [ ] エラーコード定数を定義する
  - [ ] 日付表示フォーマット定数を定義する
- Done:
  - [ ] Web / API の双方から import できる
- 推奨コミット:
  - `feat(shared): add common constants and status definitions`

### SHARED-02 共通型を実装する
- 状態: [x]
- 優先度: P0
- 依存: `SHARED-01`
- 現状メモ: Product / Task / Category / Tag / Dashboard / QR の API 契約型と関連 request / response data 型を `packages/shared` に集約済み。
- 作業:
  - [ ] Product 系型を作成する
  - [ ] Task 系型を作成する
  - [ ] Category / Tag 系型を作成する
  - [ ] Dashboard 系型を作成する
  - [ ] QR 系型を作成する
  - [ ] API response / error 型を作成する
- Done:
  - [ ] API 契約に沿った型が shared に集約されている
- 推奨コミット:
  - `feat(shared): add domain and api contract types`

### SHARED-03 共通 Zod スキーマと正規化を実装する
- 状態: [x]
- 優先度: P0
- 依存: `SHARED-02`
- 現状メモ: Product / Task / Category / Tag / QR / 一覧 query の入力 schema と再利用用の正規化 util を `packages/shared` に集約済み。
- 作業:
  - [ ] 商品入力スキーマを作成する
  - [ ] タスク入力スキーマを作成する
  - [ ] カテゴリ / タグ入力スキーマを作成する
  - [ ] 検索キーワードスキーマを作成する
  - [ ] 文字列正規化 util を作成する
  - [ ] 検索キーワード正規化 util を作成する
- Done:
  - [ ] API と Web の両方で再利用できる
- 推奨コミット:
  - `feat(shared): add zod schemas and normalization utilities`

### API-BASE-01 Express アプリ基盤を作る
- 状態: [x]
- 優先度: P0
- 依存: `BOOT-01`, `SHARED-01`
- 現状メモ: Express 初期化、`/api` ベースパス、`GET /api/health`、404 ハンドラ、request logging、共通 error handler を実装済み。
- 作業:
  - [ ] Express アプリを初期化する
  - [ ] `/api` ベースパスを設定する
  - [ ] `GET /api/health` を実装する
  - [ ] 404 ハンドラを実装する
  - [ ] 共通エラーハンドラを実装する
  - [ ] request logging を追加する
- Done:
  - [ ] `GET /api/health` が 200 を返す
  - [ ] 未定義ルートが 404 を返す
- 推奨コミット:
  - `feat(api): bootstrap express app and health endpoint`

### API-BASE-02 Firebase Admin 初期化を実装する
- 状態: [x]
- 優先度: P0
- 依存: `API-BASE-01`
- 現状メモ: Firebase Admin 初期化、Auth / Firestore / Storage の shared client、認証 middleware、公開 / 保護ルート境界を実装済み。
- 作業:
  - [ ] Firebase Admin 初期化処理を作成する
  - [ ] Firestore / Storage クライアントを共有化する
  - [ ] Auth token 検証ミドルウェアを実装する
  - [ ] 認証必須 / 認証不要ルートの境界を整理する
- Done:
  - [ ] 認証必須 API にトークン検証を適用できる
- 推奨コミット:
  - `feat(api): add firebase admin initialization and auth middleware`

### API-BASE-03 共通レスポンス整形を実装する
- 状態: [x]
- 優先度: P0
- 依存: `API-BASE-01`, `SHARED-02`
- 現状メモ: `{ data, meta }` / `{ code, message, details }` helper、`VALIDATION_ERROR` 生成、`AUTH_REQUIRED` / `AUTH_FORBIDDEN` 応答の統一を実装済み。
- 作業:
  - [ ] `{ data, meta }` レスポンス helper を作成する
  - [ ] `{ code, message, details }` エラー helper を作成する
  - [ ] `VALIDATION_ERROR` 生成を共通化する
  - [ ] `AUTH_REQUIRED` / `AUTH_FORBIDDEN` 応答を統一する
- Done:
  - [ ] サンプル API で統一形式が返る
- 推奨コミット:
  - `feat(api): add shared response and error helpers`

### WEB-BASE-01 React Web アプリを初期化する
- 状態: [x]
- 優先度: P0
- 依存: `BOOT-01`
- 現状メモ: React Router、`/login` と保護画面群のルーティング土台、共通ヘッダ、共通ナビゲーション、ページ雛形を実装済み。
- 作業:
  - [x] Vite + React + TypeScript を初期化する
  - [x] React Router を設定する
  - [x] 基本レイアウトを作成する
  - [x] 共通ヘッダ / ナビゲーションを配置する
- Done:
  - [x] `/login` と保護画面のルーティング土台がある
- 推奨コミット:
  - `feat(web): bootstrap react app and routing`

### WEB-BASE-02 Web 状態管理基盤を実装する
- 状態: [x]
- 優先度: P0
- 依存: `WEB-BASE-01`, `SHARED-03`
- 現状メモ: TanStack Query / React Hook Form + Zod / API クライアント / 認証トークン取得口 / 401・403 の共通リダイレクト基盤を実装済み。
- 作業:
  - [x] TanStack Query を導入する
  - [x] React Hook Form + Zod を導入する
  - [x] API クライアントを実装する
  - [x] 認証トークン付与処理を実装する
  - [x] 401 / 403 共通ハンドリングを実装する
- Done:
  - [x] query / mutation の基盤が利用可能
- 推奨コミット:
  - `feat(web): add query form and api client foundations`

### WEB-BASE-03 認証画面と認証ガードを実装する
- 状態: [x]
- 優先度: P0
- 依存: `WEB-BASE-02`, `API-BASE-02`
- 現状メモ: Firebase Auth ログイン、パスワード再設定導線、認証ガード、ログアウト、状態破棄、ログイン後の `/dashboard` 統一を実装済み。
- 作業:
  - [x] `/login` 画面を実装する
  - [x] Firebase Auth ログインを実装する
  - [x] パスワード再設定導線を実装する
  - [x] 認証ガードを実装する
  - [x] ログアウト処理を実装する
  - [x] ログアウト時の状態破棄を実装する
  - [x] ログアウト後の初期遷移先を `/dashboard` 前提で統一する
  - [x] URL に過去の検索条件クエリが残っていても、ログアウト直後の再ログインでは自動復元しない
- Done:
  - [x] ログイン後に `/dashboard` へ遷移する
  - [x] 未ログインで保護画面へ入れない
  - [x] ログアウト直後の再ログインで一覧条件が復元されない
- 推奨コミット:
  - `feat(web): implement auth flow and route guards`

---

## 3. Phase B: MVP 中核

### MASTER-01A Categories API 一覧を実装する
- 状態: [x]
- 優先度: P1
- 依存: `API-BASE-02`, `API-BASE-03`, `SHARED-03`
- 現状メモ: `GET /api/categories` を実装し、`usedProductCount` / `isInUse` を論理削除されていない商品から集計して返す状態。
- 作業:
  - [x] `GET /api/categories` を実装する
  - [x] `usedProductCount` / `isInUse` を返す
- Done:
  - [x] カテゴリ一覧が `usedProductCount` / `isInUse` を含めて返る
- 推奨コミット:
  - `feat(api): implement categories list endpoint`

### MASTER-01B Categories API 登録を実装する
- 状態: [x]
- 優先度: P1
- 依存: `MASTER-01A`, `API-BASE-02`
- 現状メモ: `POST /api/categories` を実装し、入力正規化・重複名チェック・`sortOrder` 未指定 / `null` 時の末尾採番を行う状態。
- 作業:
  - [x] `POST /api/categories` を実装する
  - [x] 重複名チェックを実装する
- Done:
  - [x] カテゴリ登録が仕様どおり動く
- 推奨コミット:
  - `feat(api): implement category create endpoint`

### MASTER-01C Categories API 更新を実装する
- 状態: [x]
- 優先度: P1
- 依存: `MASTER-01A`, `API-BASE-02`
- 現状メモ: `PUT /api/categories/:categoryId` を実装し、自身を除く重複名チェック・`sortOrder` 未指定 / `null` 時の末尾移動を行う状態。
- 作業:
  - [x] `PUT /api/categories/:categoryId` を実装する
  - [x] 重複名チェックを実装する
- Done:
  - [x] カテゴリ更新が仕様どおり動く
- 推奨コミット:
  - `feat(api): implement category update endpoint`

### MASTER-01D Categories API 削除を実装する
- 状態: [x]
- 優先度: P1
- 依存: `MASTER-01A`, `API-BASE-02`
- 現状メモ: `DELETE /api/categories/:categoryId` を実装し、論理削除されていない商品から参照中のカテゴリを `CATEGORY_IN_USE` で拒否する状態。
- 作業:
  - [x] `DELETE /api/categories/:categoryId` を実装する
  - [x] 未使用カテゴリのみ削除可を実装する
- Done:
  - [x] カテゴリ削除が仕様どおり動く
- 推奨コミット:
  - `feat(api): implement category delete endpoint`

### MASTER-02A Tags API 一覧を実装する
- 状態: [x]
- 優先度: P1
- 依存: `API-BASE-02`, `API-BASE-03`, `SHARED-03`
- 現状メモ: `GET /api/tags` を実装し、`name` 昇順と `usedProductCount` / `isInUse` を論理削除されていない商品の `tagIds` 参照から返す状態。
- 作業:
  - [x] `GET /api/tags` を実装する
  - [x] `usedProductCount` / `isInUse` を返す
- Done:
  - [x] タグ一覧が `usedProductCount` / `isInUse` を含めて返る
- 推奨コミット:
  - `feat(api): implement tags list endpoint`

### MASTER-02B Tags API 登録を実装する
- 状態: [x]
- 優先度: P1
- 依存: `MASTER-02A`, `API-BASE-02`
- 現状メモ: `POST /api/tags` を実装し、入力正規化と重複名チェックを行う状態。
- 作業:
  - [x] `POST /api/tags` を実装する
  - [x] 重複名チェックを実装する
- Done:
  - [x] タグ登録が仕様どおり動く
- 推奨コミット:
  - `feat(api): implement tag create endpoint`

### MASTER-02C Tags API 更新を実装する
- 状態: [x]
- 優先度: P1
- 依存: `MASTER-02A`, `API-BASE-02`
- 現状メモ: `PUT /api/tags/:tagId` を実装し、自身を除く重複名チェックと `updatedAt` 更新を行う状態。
- 作業:
  - [x] `PUT /api/tags/:tagId` を実装する
  - [x] 重複名チェックを実装する
- Done:
  - [x] タグ更新が仕様どおり動く
- 推奨コミット:
  - `feat(api): implement tag update endpoint`

### MASTER-02D Tags API 削除を実装する
- 状態: [x]
- 優先度: P1
- 依存: `MASTER-02A`, `API-BASE-02`
- 現状メモ: `DELETE /api/tags/:tagId` を実装し、`isDeleted=false` の商品で参照中のタグは `TAG_IN_USE` として削除不可にした状態。
- 作業:
  - [x] `DELETE /api/tags/:tagId` を実装する
  - [x] 未使用タグのみ削除可を実装する
- Done:
  - [x] タグ削除が仕様どおり動く
- 推奨コミット:
  - `feat(api): implement tag delete endpoint`

### MASTER-03A Categories 管理画面を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `MASTER-01A`, `MASTER-01B`, `MASTER-01C`, `MASTER-01D`, `WEB-BASE-03`
- 作業:
  - [ ] `/categories` を実装する
  - [ ] 一覧 / 追加 / 更新 / 削除 UI を実装する
  - [ ] 使用中件数表示を実装する
  - [ ] エラーメッセージ表示を実装する
- Done:
  - [ ] カテゴリ管理画面から CRUD 操作ができる
- 推奨コミット:
  - `feat(web): implement category management page`

### MASTER-03B Tags 管理画面を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `MASTER-02A`, `MASTER-02B`, `MASTER-02C`, `MASTER-02D`, `WEB-BASE-03`
- 作業:
  - [ ] `/tags` を実装する
  - [ ] 一覧 / 追加 / 更新 / 削除 UI を実装する
  - [ ] 使用中件数表示を実装する
  - [ ] エラーメッセージ表示を実装する
- Done:
  - [ ] タグ管理画面から CRUD 操作ができる
- 推奨コミット:
  - `feat(web): implement tag management page`

### PRODUCT-01 Products API 一覧を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `API-BASE-02`, `API-BASE-03`, `MASTER-01A`, `MASTER-02A`, `SHARED-03`
- 作業:
  - [ ] `GET /api/products` を実装する
  - [ ] ページングを実装する
  - [ ] `keyword` / `categoryId` / `tagId` / `status` / `includeSold` を実装する
  - [ ] 検索後段フィルタを実装する
  - [ ] `thumbnailUrl` 生成を実装する
- Done:
  - [ ] API 仕様どおりの `meta` を返す
- 推奨コミット:
  - `feat(api): implement products list endpoint`

### PRODUCT-02 商品一覧画面を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-01`, `MASTER-01A`, `MASTER-02A`, `WEB-BASE-03`
- 作業:
  - [ ] `/products` を実装する
  - [ ] 検索欄を実装する
  - [ ] カテゴリ / タグ / ステータス絞り込みを実装する
  - [ ] 並び替えを実装する
  - [ ] `includeSold` 切替を実装する
  - [ ] URL クエリ同期を実装する
  - [ ] ログアウト直後の再ログインでは URL に旧クエリが残っていても一覧条件を自動復元しない
  - [ ] 0件 / 再試行表示を実装する
- Done:
  - [ ] 設計どおりの検索条件で一覧が動く
  - [ ] URL クエリ保持と再ログイン時の非復元条件が両立している
- 推奨コミット:
  - `feat(web): implement products list page`

### PRODUCT-03 Products API 登録を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-01`, `API-BASE-02`
- 作業:
  - [ ] `POST /api/products` を実装する
  - [ ] 商品ID採番を実装する
  - [ ] カテゴリ / タグ参照チェックを実装する
  - [ ] `soldAt` 自動設定を実装する
- Done:
  - [ ] 正常登録で `201 Created` を返す
- 推奨コミット:
  - `feat(api): implement product creation endpoint`

### PRODUCT-04 商品登録画面を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-03`, `MASTER-01A`, `MASTER-02A`, `WEB-BASE-03`
- 作業:
  - [ ] `/products/new` を実装する
  - [ ] 必須項目バリデーションを実装する
  - [ ] 保存成功後の詳細遷移を実装する
  - [ ] 未保存時の画像操作無効化を実装する
- Done:
  - [ ] 商品の新規登録が UI から完了できる
- 推奨コミット:
  - `feat(web): implement product creation page`

### PRODUCT-05A Products API 詳細取得を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-03`, `API-BASE-02`
- 作業:
  - [ ] `GET /api/products/:productId` を実装する
  - [ ] 論理削除判定を実装する
  - [ ] `images[].displayUrl` / `images[].thumbnailUrl` / `urlExpiresAt` を返す
  - [ ] `tasksSummary` を返す
  - [ ] `qrCodeValue` を返す
- Done:
  - [ ] 未存在 / 論理削除時の 404 が統一されている
  - [ ] 商品詳細画面が必要とする項目を詳細APIが返せる
- 推奨コミット:
  - `feat(api): implement product detail endpoint`

### PRODUCT-05B Products API 更新を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05A`, `API-BASE-02`
- 作業:
  - [ ] `PUT /api/products/:productId` を実装する
  - [ ] カテゴリ / タグ参照チェックを実装する
  - [ ] `primaryImageId` の受け取りを実装する
  - [ ] `primaryImageId` 未送信時の `VALIDATION_ERROR` を実装する
  - [ ] 不正な `primaryImageId` 指定時の検証を実装する
  - [ ] `primaryImageId` を `images[].isPrimary` に正規化する
  - [ ] ステータス更新時の `soldAt` 制御を実装する
  - [ ] 販売済から戻すときの `soldAt=null` を実装する
- Done:
  - [ ] 商品更新が仕様どおり反映される
  - [ ] `primaryImageId` と `images[].isPrimary` の整合が保たれる
  - [ ] `soldAt` の補完 / 解除が正しく制御される
- 推奨コミット:
  - `feat(api): implement product update endpoint`

### PRODUCT-05C Products API 論理削除を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05A`, `API-BASE-02`
- 作業:
  - [ ] `DELETE /api/products/:productId` を実装する
  - [ ] `isDeleted` / `deletedAt` / `updatedAt` 更新を実装する
  - [ ] 論理削除済み商品の再参照不可を確認する
- Done:
  - [ ] 商品削除が論理削除として保存される
  - [ ] 論理削除済み商品が通常APIから参照できない
- 推奨コミット:
  - `feat(api): implement product soft delete endpoint`

### TASK-01A Tasks API 一覧取得を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05A`, `SHARED-03`, `API-BASE-02`
- 作業:
  - [ ] `GET /api/products/:productId/tasks` を実装する
  - [ ] 商品存在チェックと論理削除判定を実装する
- Done:
  - [ ] 商品単位のタスク一覧取得ができる
- 推奨コミット:
  - `feat(api): implement task list endpoint`

### TASK-01B Tasks API 登録を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `TASK-01A`, `API-BASE-02`
- 作業:
  - [ ] `POST /api/products/:productId/tasks` を実装する
  - [ ] 初期値 `isCompleted=false` / `completedAt=null` を実装する
- Done:
  - [ ] 商品単位のタスク登録ができる
- 推奨コミット:
  - `feat(api): implement task create endpoint`

### TASK-01C Tasks API 更新を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `TASK-01A`, `API-BASE-02`
- 作業:
  - [ ] `PUT /api/tasks/:taskId` を実装する
  - [ ] タスク存在チェックを実装する
- Done:
  - [ ] タスク更新が仕様どおり動く
- 推奨コミット:
  - `feat(api): implement task update endpoint`

### TASK-01D Tasks API 削除を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `TASK-01A`, `API-BASE-02`
- 作業:
  - [ ] `DELETE /api/tasks/:taskId` を実装する
  - [ ] タスク存在チェックを実装する
- Done:
  - [ ] タスク削除が仕様どおり動く
- 推奨コミット:
  - `feat(api): implement task delete endpoint`

### TASK-01E Tasks API 完了切替を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `TASK-01A`, `API-BASE-02`
- 作業:
  - [ ] `PATCH /api/tasks/:taskId/completion` を実装する
  - [ ] `completedAt` 制御を実装する
- Done:
  - [ ] 完了切替で `completedAt` が正しく制御される
- 推奨コミット:
  - `feat(api): implement task completion endpoint`

### PRODUCT-06A 商品詳細画面 UI を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05A`, `WEB-BASE-03`
- 作業:
  - [ ] `/products/:productId` を実装する
  - [ ] 基本情報表示を実装する
  - [ ] 代表画像 / プレースホルダー表示を実装する
  - [ ] 関連タスク一覧の参照表示を実装する
  - [ ] タスク管理 / 編集 / QR への導線を配置する
- Done:
  - [ ] 商品詳細の参照系 UI が成立する
  - [ ] 商品一覧 → 商品詳細導線がつながる
- 推奨コミット:
  - `feat(web): implement product detail page`

### PRODUCT-06B 商品編集画面 UI を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05B`, `MASTER-01A`, `MASTER-02A`, `PRODUCT-06A`
- 作業:
  - [ ] `/products/:productId/edit` を実装する
  - [ ] 編集フォーム初期値表示を実装する
  - [ ] 編集保存を実装する
  - [ ] 販売済戻し確認ダイアログを実装する
  - [ ] 画像UIは `IMAGE-03A` / `IMAGE-03B` に分離する
- Done:
  - [ ] 商品の編集保存が UI から完了できる
  - [ ] 販売済戻しの確認導線がある
- 推奨コミット:
  - `feat(web): implement product edit page`

### PRODUCT-06C 商品詳細上の危険操作 / 関連タスク quick action を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05C`, `TASK-01E`, `PRODUCT-06A`
- 作業:
  - [ ] 商品削除確認ダイアログを実装する
  - [ ] 商品詳細上のタスク完了切替を実装する
  - [ ] 商品詳細上のタスク追加 / 編集 / 削除は対象外であり `TASK-02B` に寄せることを明記する
  - [ ] QR 表示 / 読み取り導線の実処理は `QR-02A` / `QR-02B` / `QR-02C` に寄せることを明記する
- Done:
  - [ ] 商品詳細で危険操作と quick action が成立する
  - [ ] 商品詳細とタスク管理画面の責務境界が明確である
- 推奨コミット:
  - `feat(web): add product detail destructive actions and task quick toggle`

### TASK-02A タスク管理画面の参照 UI を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `TASK-01A`, `PRODUCT-06A`, `WEB-BASE-03`
- 作業:
  - [ ] `/products/:productId/tasks` を実装する
  - [ ] 一覧表示を実装する
  - [ ] 商品詳細からの遷移導線を接続する
- Done:
  - [ ] 商品詳細 → タスク管理画面の参照導線がつながる
- 推奨コミット:
  - `feat(web): implement task management page read flow`

### TASK-02B タスク管理画面の追加 / 編集 / 削除 UI を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `TASK-02A`, `TASK-01B`, `TASK-01C`, `TASK-01D`
- 作業:
  - [ ] タスク追加 UI を実装する
  - [ ] タスク編集 UI を実装する
  - [ ] タスク削除 UI を実装する
- Done:
  - [ ] タスクの追加 / 編集 / 削除が画面上で完結する
- 推奨コミット:
  - `feat(web): add task create edit and delete ui`

### TASK-02C タスク管理画面の完了切替 / 表示条件を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `TASK-02A`, `TASK-01E`
- 作業:
  - [ ] 完了済み表示切替を実装する
  - [ ] 完了 / 未完了切替 UI を実装する
  - [ ] 商品詳細上の簡易表示と責務が重複しないことを確認する
- Done:
  - [ ] 商品単位のタスク管理が画面として完結する
- 推奨コミット:
  - `feat(web): add task completion and filtering ui`

### IMAGE-01 画像処理基盤を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05A`, `API-BASE-02`
- 作業:
  - [ ] `multer` memoryStorage を設定する
  - [ ] `sharp` で画像変換を実装する
  - [ ] Exif 向き補正を実装する
  - [ ] 表示用 2000px WebP を実装する
  - [ ] サムネイル 400px WebP を実装する
  - [ ] MIME type / 10MB / 10枚上限チェックを実装する
- Done:
  - [ ] 画像バッファから display / thumb を生成できる
- 推奨コミット:
  - `feat(api): add image processing pipeline`

### IMAGE-02A 商品画像追加 API を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `IMAGE-01`, `PRODUCT-05A`, `API-BASE-02`
- 作業:
  - [ ] `POST /api/products/:productId/images` を実装する
  - [ ] Storage 保存を実装する
  - [ ] 10枚上限チェックを接続する
- Done:
  - [ ] API から画像追加ができる
- 推奨コミット:
  - `feat(api): implement product image create endpoint`

### IMAGE-02B 商品画像差し替え API を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `IMAGE-02A`, `API-BASE-02`
- 作業:
  - [ ] `PUT /api/products/:productId/images/:imageId` を実装する
  - [ ] `imageId` / `sortOrder` 維持を実装する
- Done:
  - [ ] API から画像差し替えができる
- 推奨コミット:
  - `feat(api): implement product image replace endpoint`

### IMAGE-02C 商品画像削除 / 並び補正 API を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `IMAGE-02A`, `API-BASE-02`
- 作業:
  - [ ] `DELETE /api/products/:productId/images/:imageId` を実装する
  - [ ] Storage 実体削除を実装する
  - [ ] `sortOrder` 詰め直しを実装する
  - [ ] 代表画像制御を実装する
- Done:
  - [ ] API から画像削除後の整合が保たれる
- 推奨コミット:
  - `feat(api): implement product image delete endpoint`

### IMAGE-03A 商品編集画面の画像追加 / 差し替え UI を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `IMAGE-02A`, `IMAGE-02B`, `PRODUCT-06B`
- 作業:
  - [ ] 画像追加 UI を実装する
  - [ ] 画像差し替え UI を実装する
  - [ ] 更新後の再取得 / 再描画を実装する
- Done:
  - [ ] 商品編集画面で画像追加 / 差し替えができる
- 推奨コミット:
  - `feat(web): implement product image add and replace ui`

### IMAGE-03B 商品編集画面の画像削除 / 代表画像 UI を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `IMAGE-02C`, `IMAGE-03A`
- 作業:
  - [ ] 画像削除 UI を実装する
  - [ ] 代表画像選択 UI を実装する
  - [ ] 更新後の再取得 / 再描画を実装する
- Done:
  - [ ] 商品編集画面で画像削除 / 代表画像変更が完結する
- 推奨コミット:
  - `feat(web): implement product image delete and primary ui`

---

## 4. Phase C: 周辺機能

### DASH-01 Dashboard API を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05A`, `TASK-01A`, `API-BASE-02`
- 作業:
  - [ ] `GET /api/dashboard` を実装する
  - [ ] ステータス別件数集計を実装する
  - [ ] 販売済件数集計を実装する
  - [ ] 未完了タスク件数集計を実装する
  - [ ] 納期が近いタスク抽出を実装する
  - [ ] 最近更新商品取得を実装する
- Done:
  - [ ] API 仕様どおりの集計が返る
- 推奨コミット:
  - `feat(api): implement dashboard endpoint`

### DASH-02 ダッシュボード画面を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `DASH-01`, `WEB-BASE-03`
- 作業:
  - [ ] `/dashboard` を実装する
  - [ ] 件数カードを表示する
  - [ ] 納期が近いタスク一覧を表示する
  - [ ] 最近更新商品一覧を表示する
  - [ ] 詳細 / タスク管理導線を実装する
- Done:
  - [ ] ログイン直後画面として機能する
- 推奨コミット:
  - `feat(web): implement dashboard page`

### QR-01A QR lookup API を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05A`, `API-BASE-02`
- 作業:
  - [ ] `POST /api/qr/lookup` を実装する
  - [ ] `reasonCode` を仕様どおり返す
  - [ ] 更新可否判定を実装する
- Done:
  - [ ] QR 読取結果の照会が仕様どおり返る
- 推奨コミット:
  - `feat(api): implement qr lookup endpoint`

### QR-01B QR sell API を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `QR-01A`, `API-BASE-02`
- 作業:
  - [ ] `POST /api/qr/sell` を実装する
  - [ ] `onDisplay` / `inStock` のみ更新可にする
  - [ ] `sold` の重複更新防止を実装する
- Done:
  - [ ] QR 販売済更新の業務ルールが通る
- 推奨コミット:
  - `feat(api): implement qr sell endpoint`

### QR-02A 商品詳細の QR 表示を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `QR-01A`, `PRODUCT-06A`, `WEB-BASE-03`
- 作業:
  - [ ] 商品詳細で QR コード表示を実装する
  - [ ] `qrcode` で生成する
- Done:
  - [ ] 商品詳細画面で QR を表示できる
- 推奨コミット:
  - `feat(web): implement qr display on product detail`

### QR-02B QR 読み取り画面と lookup 結果表示を実装する
- 状態: [ ]
- 優先度: P1
- 依存: `QR-01A`, `PRODUCT-06A`, `WEB-BASE-03`
- 作業:
  - [ ] `/qr` を実装する
  - [ ] `html5-qrcode` で読み取りを実装する
  - [ ] 多重読み取り防止を実装する
  - [ ] lookup 結果表示を実装する
- Done:
  - [ ] QR 読み取りから lookup 結果表示までつながる
- 推奨コミット:
  - `feat(web): implement qr scanner and lookup result page`

### QR-02C 販売済更新確認フローを実装する
- 状態: [ ]
- 優先度: P1
- 依存: `QR-01B`, `QR-02B`
- 作業:
  - [ ] 販売済更新確認ダイアログを実装する
  - [ ] canSell=true の場合のみ更新実行できるようにする
  - [ ] 更新後の詳細遷移または再読取導線を実装する
- Done:
  - [ ] 商品詳細 → QR読取 → 販売済更新 がつながる
- 推奨コミット:
  - `feat(web): implement qr sell confirmation flow`

### LOG-00 LOGIN 記録APIの設計反映を行う
- 状態: [ ]
- 優先度: P1
- 依存: なし
- 作業:
  - [ ] `api_specification.md` に LOGIN 記録APIのパス / メソッド / 認証要否 / 入出力 / エラーを追記する
  - [ ] `detail_design.md` に LOGIN ログ記録フローを追記する
  - [ ] `test_design.md` / `test_cases.md` に LOGIN ログ確認観点を追記または整合確認する
  - [ ] TODO 内のログ系タスクと設計書の対応関係を確認する
- Done:
  - [ ] LOGIN 記録APIが設計書上で曖昧でない
  - [ ] `LOG-01B` 以降が設計書整合前提で着手できる
- 推奨コミット:
  - `docs: align login operation log api design`

### LOG-01A operationLogs 記録方針を固定する
- 状態: [ ]
- 優先度: P1
- 依存: `LOG-00`, `API-BASE-02`, `API-BASE-03`, `WEB-BASE-03`
- 作業:
  - [ ] ログ対象イベントを `LOGIN` / `PRODUCT_UPDATED` / `PRODUCT_DELETED` / `QR_SOLD` / `ERROR` で固定する
  - [ ] `LOGIN` はフロント認証成功後、**専用の認証済み API** を呼んで記録する方針で固定する
  - [ ] `LOG-00` で反映した `LOGIN` 記録API設計を正本として扱う
  - [ ] API側の共通 `operationLogs` 書き込み util を用意する
  - [ ] `eventType` / `targetId` / `summary` / `actorUid` / `createdAt` / `detail` の最低項目を固定する
- Done:
  - [ ] ログ記録方針が実装前に固定されている
  - [ ] `LOGIN` ログの経路が曖昧でない
  - [ ] `LOGIN` 記録APIの設計と TODO の前提が一致している
- 推奨コミット:
  - `chore(api): fix operation logs recording strategy`

### LOG-01B LOGIN 記録APIとログ書き込みを実装する
- 状態: [ ]
- 優先度: P1
- 依存: `LOG-01A`, `API-BASE-02`
- 作業:
  - [ ] 設計反映済みの `LOGIN` 記録APIを追加する
  - [ ] ログイン成功後にフロントからその API を呼ぶ
  - [ ] API 側で `LOGIN` を `operationLogs` に記録する
- Done:
  - [ ] 正常ログイン時に `LOGIN` が記録される
  - [ ] `LOGIN` 記録経路がコード上で一意に追える
- 推奨コミット:
  - `feat(api): add login operation log endpoint`

### LOG-01C 業務操作ログを書き込む
- 状態: [ ]
- 優先度: P1
- 依存: `LOG-01A`, `PRODUCT-05B`, `PRODUCT-05C`, `QR-01B`, `API-BASE-02`
- 作業:
  - [ ] `PRODUCT_UPDATED` を記録する
  - [ ] `PRODUCT_DELETED` を記録する
  - [ ] `QR_SOLD` を記録する
- Done:
  - [ ] 主要業務操作ログが Firestore に残る
- 推奨コミット:
  - `feat(api): add operation logs for core mutations`

### LOG-01D 主要エラーログを書き込む
- 状態: [ ]
- 優先度: P1
- 依存: `LOG-01A`, `API-BASE-02`
- 作業:
  - [ ] `ERROR` ログを書き込む
  - [ ] 原因調査に必要な最小 detail を残す
- Done:
  - [ ] 主要エラー発生時に `ERROR` が記録される
- 推奨コミット:
  - `feat(api): add error operation log`

### LOG-02 フロントのエラーメッセージマッピングを実装する
- 状態: [ ]
- 優先度: P1
- 依存: `WEB-BASE-02`
- 作業:
  - [ ] `error-messages.md` に沿ったコード → 文言変換を実装する
  - [ ] 項目エラー表示を実装する
  - [ ] 画面上部アラートを実装する
  - [ ] 画面内エラーを実装する
  - [ ] トースト表示を実装する
- Done:
  - [ ] 主要画面で統一文言が出る
- 推奨コミット:
  - `feat(web): add unified error message mapping`

---

## 5. Phase D: 仕上げ

### TEST-01 shared / util 単体テストを書く
- 状態: [x]
- 優先度: P1
- 依存: `SHARED-03`
- 現状メモ: `packages/shared` に正規化 util / 検索キーワード / 共通 schema のテストを追加済み。workspace test と root `npm run ci` で通過確認済み。
- 作業:
  - [x] 正規化 util テスト
  - [x] 検索キーワードテスト
  - [x] 共通定数 / schema の基本テスト
- Done:
  - [x] shared / util の主要境界条件が自動化されている
- 推奨コミット:
  - `test(shared): add unit tests for shared utilities and schemas`

### TEST-02 API テストを書く
- 状態: [ ]
- 優先度: P1
- 依存: `PRODUCT-05A`, `PRODUCT-05B`, `PRODUCT-05C`, `IMAGE-02A`, `IMAGE-02B`, `IMAGE-02C`, `TASK-01A`, `TASK-01B`, `TASK-01C`, `TASK-01D`, `TASK-01E`, `MASTER-01A`, `MASTER-01B`, `MASTER-01C`, `MASTER-01D`, `MASTER-02A`, `MASTER-02B`, `MASTER-02C`, `MASTER-02D`, `DASH-01`, `QR-01A`, `QR-01B`, `LOG-01B`, `LOG-01C`, `LOG-01D`
- 作業:
  - [ ] Health API
  - [ ] Products API
  - [ ] Product Images API
  - [ ] Tasks API
  - [ ] Categories / Tags API
  - [ ] Dashboard API
  - [ ] QR API
  - [ ] `soldAt` 制御テスト
  - [ ] `completedAt` 制御テスト
  - [ ] `LOGIN` 記録APIを含む認証エラー系
  - [ ] `LOGIN` / `PRODUCT_UPDATED` / `PRODUCT_DELETED` / `QR_SOLD` / `ERROR` の主要 operationLogs 記録確認
- Done:
  - [ ] 主要エンドポイントの正常 / 異常系が自動化されている
  - [ ] 日時制御と認証系の主要業務ルールが API テストで担保されている
  - [ ] 主要 operationLogs の記録整合が API テストで担保されている
- 推奨コミット:
  - `test(api): add integration tests for core endpoints and domain rules`

### TEST-03 Web 画面テストを書く
- 状態: [ ]
- 優先度: P1
- 依存: `WEB-BASE-03`, `PRODUCT-06A`, `PRODUCT-06B`, `PRODUCT-06C`, `IMAGE-03A`, `IMAGE-03B`, `TASK-02A`, `TASK-02B`, `TASK-02C`, `MASTER-03A`, `MASTER-03B`, `DASH-02`, `QR-02A`, `QR-02B`, `QR-02C`
- 作業:
  - [ ] ログイン画面
  - [ ] 商品一覧
  - [ ] 商品詳細
  - [ ] 商品登録 / 編集
  - [ ] タスク管理
  - [ ] カテゴリ / タグ管理
  - [ ] ダッシュボード
  - [ ] QR 画面
- Done:
  - [ ] 主要画面のレンダリングと主要導線が自動化されている
- 推奨コミット:
  - `test(web): add tests for core pages and flows`

### INFRA-01 Firebase 反映確認を行う
- 状態: [ ]
- 優先度: P1
- 依存: `BOOT-03`
- 作業:
  - [ ] `firebase/firestore.rules` を反映する
  - [ ] `firebase/storage.rules` を反映する
  - [ ] `firebase/firestore.indexes.json` を反映する
  - [ ] Firebase Emulator を起動し、Auth / Firestore / Storage / Hosting の基本疎通を確認する
- Done:
  - [ ] rules / indexes の反映手順が確認できている
  - [ ] Firebase Emulator が設計どおりのポートで起動する
  - [ ] Firebase 反映対象ファイルのパスが TODO 上で明確になっている
- 推奨コミット:
  - `chore(firebase): apply rules and indexes configuration`

### INFRA-02 Cloud Run / Hosting デプロイ基盤を整える
- 状態: [ ]
- 優先度: P1
- 依存: `API-BASE-01`, `WEB-BASE-01`
- 作業:
  - [ ] API 用 Dockerfile を作成する
  - [ ] Cloud Build ビルド手順を整える
  - [ ] Cloud Run 環境変数を整理する
  - [ ] Hosting の `/api` rewrite を確認する
- Done:
  - [ ] Web + API を検証環境へ反映できる
- 推奨コミット:
  - `chore(deploy): add cloud run and hosting deployment setup`

### SEC-01 dev-only 脆弱性対応を行う
- 状態: [x]
- 優先度: P2
- 依存: `BOOT-02`, `TEST-01`, `TEST-02`, `TEST-03`
- 現状メモ: `package-lock.json` を正本化し、`npm audit` / `npm audit --omit=dev` の棚卸し、dev-only 脆弱性対応方針、prod-low 許容判断メモを `docs/implementation-notes.md` に反映済み。依存順より先に実施したため、リリース前の再監査は `REL-01` で再実行する。
- 作業:
  - [x] `package-lock.json` を正本に `npm audit` と `npm audit --omit=dev` を再実行する
  - [x] `vite` / `vitest` / `vite-node` / `@vitest/mocker` / `esbuild` の dev-only 脆弱性を棚卸しする
  - [x] 非破壊で更新できる範囲を確認し、難しい場合はメジャー更新の分離方針を整理する
  - [x] dev server をローカル限定で使う運用条件と、更新見送り条件を docs に反映する
- Done:
  - [x] dev-only 脆弱性の対象パッケージ、影響範囲、更新方針が文書化されている
  - [x] 更新した場合は `lint` / `typecheck` / `test` / `build` が通る
  - [x] 更新を見送る場合も、ローカル限定運用の条件が docs に残っている
- 推奨コミット:
  - `chore(dev): assess and mitigate dev-only dependency vulnerabilities`

### REL-01 リリース前確認を行う
- 状態: [ ]
- 優先度: P2
- 依存: `TEST-01`, `TEST-02`, `TEST-03`, `INFRA-02`, `SEC-01`
- 作業:
  - [ ] `test_design.md` の観点消化を確認する
  - [ ] `test_cases.md` の主要ケース消化を確認する
  - [ ] README を実装内容に合わせて更新する
  - [ ] 未実装項目を次期課題へ分離する
  - [ ] リリース判定エビデンスを保存する
- Done:
  - [ ] MVP リリース判断に必要な記録がそろう
- 推奨コミット:
  - `docs: finalize release checklist and implementation status`

---

## 6. Codex が最初に着手すべき順番

### 6-0. 推奨実行順一覧（Ready Queue の選択基準）

Ready Queue は、**依存を満たしていて、かつ未完了のタスクだけ** を指す。  
Codex は毎回、まず `[~]` の再開対象があるかを確認し、なければ Ready Queue を確認したうえで、**この節の番号付き一覧で最上位の 1件だけ** を選んで着手する。

現時点のリポジトリでは、**`BOOT-01` / `BOOT-02` / `BOOT-03` / `SHARED-01` / `SHARED-02` / `SHARED-03` / `API-BASE-01` / `API-BASE-02` / `API-BASE-03` / `WEB-BASE-01` / `WEB-BASE-02` / `WEB-BASE-03` / `MASTER-01A` / `MASTER-01B` / `MASTER-01C` / `MASTER-01D` / `MASTER-02A` / `MASTER-02B` / `MASTER-02C` / `MASTER-02D` / `TEST-01` / `SEC-01` は完了** である。  
そのため、**次に着手する新規の `[ ]` タスクは、番号付き一覧で最上位の `MASTER-03A`** とする。  
また、**`LOG-00` は依存なしで Ready であっても、Phase A の土台タスク（`BOOT-*` / `SHARED-*` / `API-BASE-*` / `WEB-BASE-*`）に未完了がある間は着手保留としてよい**。  
`LOG-00` は、上記の土台タスクが完了した時点、または **その時点で他により上位の再開 / Ready タスクが存在しない場合** に着手候補へ戻す。

- 現在の完了: `BOOT-01`, `BOOT-02`, `BOOT-03`, `SHARED-01`, `SHARED-02`, `SHARED-03`, `API-BASE-01`, `API-BASE-02`, `API-BASE-03`, `WEB-BASE-01`, `WEB-BASE-02`, `WEB-BASE-03`, `MASTER-01A`, `MASTER-01B`, `MASTER-01C`, `MASTER-01D`, `MASTER-02A`, `MASTER-02B`, `MASTER-02C`, `MASTER-02D`, `TEST-01`, `SEC-01`
- 現在の再開候補: なし
- 現在の最優先: `MASTER-03A`
- `LOG-00` の扱い: Ready ではあるが、Phase A 完了までは着手保留としてよい

以下の番号付き一覧は、**依存関係を満たした後の推奨実行順** を示す。  
Codex は常に、依存を満たしているタスクのうち **この一覧で最上位の未完了タスク 1つ** に着手する。

1. `BOOT-01`
2. `BOOT-02`
3. `BOOT-03`
4. `SHARED-01`
5. `SHARED-02`
6. `SHARED-03`
7. `API-BASE-01`
8. `API-BASE-02`
9. `API-BASE-03`
10. `WEB-BASE-01`
11. `WEB-BASE-02`
12. `WEB-BASE-03`
13. `MASTER-01A`
14. `MASTER-02A`
15. `PRODUCT-01`
16. `PRODUCT-02`
17. `PRODUCT-03`
18. `PRODUCT-04`
19. `PRODUCT-05A`
20. `TASK-01A`
21. `PRODUCT-06A`
22. `TASK-01B`
23. `TASK-01E`
24. `PRODUCT-05B`
25. `PRODUCT-06B`
26. `PRODUCT-05C`
27. `PRODUCT-06C`
28. `TASK-01C`
29. `TASK-01D`
30. `TASK-02A`
31. `TASK-02B`
32. `TASK-02C`
33. `IMAGE-01`
34. `IMAGE-02A`
35. `IMAGE-02B`
36. `IMAGE-02C`
37. `IMAGE-03A`
38. `IMAGE-03B`
39. `DASH-01`
40. `DASH-02`
41. `QR-01A`
42. `QR-02A`
43. `QR-02B`
44. `QR-01B`
45. `QR-02C`
46. `MASTER-01B`
47. `MASTER-01C`
48. `MASTER-01D`
49. `MASTER-02B`
50. `MASTER-02C`
51. `MASTER-02D`
52. `MASTER-03A`
53. `MASTER-03B`
54. `LOG-00`
55. `LOG-01A`
56. `LOG-01B`
57. `LOG-01C`
58. `LOG-01D`
59. `LOG-02`
60. `TEST-01`
61. `TEST-02`
62. `TEST-03`
63. `INFRA-01`
64. `INFRA-02`
65. `SEC-01`
66. `REL-01`

## 7. Codex 用の実行テンプレート

この章は、Codex が毎回そのまま使える最小テンプレート集である。  
**着手前宣言 → 実装 → 完了報告** の順で使う。  
本章のテンプレートは、**冒頭の実行ルール / 0-7 / 0-7A / 0-7B / 0-12 を上書きせず、そのまま揃えるための再掲** として使う。

### 7-0. 着手前宣言テンプレート

```md
Task: PRODUCT-05A
Depends on:
- PRODUCT-04

Read docs:
- api_specification.md
- detail_design.md
- data_design.md

In scope:
- `GET /api/products/:productId` の route 追加
- service / repository 実装
- 404 / 論理削除判定
- response 形式統一

Out of scope:
- 更新API
- 削除API
- 商品詳細UI

Checks planned:
- npm run lint
- npm run typecheck
- 関連APIテスト
```

### 7-1. 完了報告テンプレート

```md
Task: PRODUCT-05A
Status: Done
Changed files:
- apps/api/src/routes/products.ts
- apps/api/src/services/products/getProductDetail.ts
- packages/shared/src/...

Checks:
- npm run lint
- npm run typecheck
- 関連APIテスト

Notes:
- `GET /api/products/:productId` を実装
- 未存在 / 論理削除時の 404 を統一
- 更新APIは未対応
- 商品詳細UIは未対応

Next:
- PRODUCT-05B
```

各タスク着手時は、以下の形で進める。

```md
Task: PRODUCT-05A
Depends on:
- PRODUCT-04

Read docs:
- api_specification.md
- detail_design.md
- data_design.md

In scope:
- route
- request / response schema
- service / repository
- 404 / 論理削除判定

Out of scope:
- 更新API
- 削除API
- 商品詳細UI

Checks planned:
- npm run lint
- npm run typecheck
- 関連APIテスト
```

### 7-2. API タスク用ミニテンプレート

```md
Task:
Depends on:
Read docs:
In scope:
Out of scope:
Checks planned:
```

### 7-3. Web タスク用ミニテンプレート

```md
Task:
Depends on:
Read docs:
In scope:
Out of scope:
Checks planned:
```

### 7-4. Infra / Test タスク用ミニテンプレート

```md
Task:
Depends on:
Read docs:
In scope:
Out of scope:
Checks planned:
```


### 7-5. Codex へそのまま貼る共通指示文

以下は、Codex に毎回そのまま渡せる共通指示文である。  
必要に応じて `TASK_ID` だけ差し替えて使う。

```md
あなたはこのリポジトリの実装担当です。
以下のルールを厳守して、今回の対応は **1タスクだけ** 完了してください。

ルール:
- 対応対象は `TASK_ID` のみ
- 依存未解決なら実装せず、その理由を報告する
- 先に読む文書は、そのタスクに必要なものだけに限定する
- 設計書にない独自仕様を追加しない
- API と UI を同時に大きく広げない
- 差分が大きくなる場合は、実装を広げず最小実装で止める
- 完了時は `Task / Status / Changed files / Checks / Notes / Next` を必ず報告する

まず最初に、次を短く出力してください。
1. 今回対応する Task
2. Depends on
3. Read docs
4. In scope
5. Out of scope
6. Checks planned

その後に実装を進めてください。
```

### 7-6. 単一タスク着手用の指示文テンプレート

```md
次の 1 タスクだけ対応してください: `TASK_ID`

守ること:
- 依存タスクが未完了なら、実装せず BLOCKED として報告する
- このタスクの主責務以外は実装しない
- 必要最小限の差分で完了させる
- 設計差分が見つかった場合は、コード先行で拡張しない
- 完了時は実行メモ形式で報告する

作業手順:
1. `TASK_ID` の依存関係を確認
2. 必要な設計書だけ読む
3. `In scope / Out of scope` を明示
4. 実装
5. `lint` / `typecheck` / 関連テスト
6. 実行メモを出力

出力形式:
Task:
Status:
Depends on:
Read docs:
In scope:
Out of scope:
Changed files:
Checks:
Notes:
Next:
```

### 7-7. Ready Queue から自動で次タスクを選ばせる指示文

```md
この TODO に従って、Ready Queue から **依存を満たす最上位の未完了タスク 1件だけ** を選んで対応してください。

選定ルール:
- 依存未解決タスクは選ばない
- 推奨実行順で最上位を優先する
- 同じターンで複数タスクを進めない

開始前に必ず出力:
- Selected task
- Why this task is ready
- Depends on
- Read docs
- In scope
- Out of scope
- Checks planned

完了時に必ず出力:
- Task
- Status
- Changed files
- Checks
- Notes
- Next
```

### 7-8. 依存未解決・BLOCKED 時の指示文テンプレート

```md
次のタスクに着手しようとしています: `TASK_ID`

まず依存関係を確認し、未解決なら実装を始めないでください。
未解決だった場合は、以下の形式だけを返してください。

Task: TASK_ID
Status: BLOCKED
Blocked by:
- 未完了の依存タスクID

Reason:
- 今は着手できない理由

Needed:
- 先に満たすべき条件

Next candidate:
- 先に完了すべきタスクID
```

### 7-9. 差分が大きすぎる場合の分割指示文テンプレート

```md
`TASK_ID` を進める中で、差分が大きすぎる・責務が複数に分かれると判断した場合は、勝手に広げて実装しないでください。

対応方針:
- 今回の主責務だけを残す
- それ以外は `Notes` に未対応として明記する
- 必要なら「このタスクは実質的に次の 2 つへ分かれる」と短く提案する
- ただし、TODO本文のタスクID自体は勝手に変更しない

完了報告では次を必ず含めてください。
- 今回あえてやらなかったこと
- なぜ分割が必要か
- 次に着手すべき候補
```

### 7-10. 完了報告を強制する指示文テンプレート

```md
実装が終わったら、最後は必ず次の形式で報告してください。

Task: TASK_ID
Status: Done
Changed files:
- path/to/file

Checks:
- 実行した確認
- 成功 / 失敗

Notes:
- 何を実装したか
- 仕様上どこまで満たしたか
- 今回やらなかったこと
- 注意点
- 残課題

Next:
- 次に着手すべきタスクID
```

### 7-11. 具体例: BOOT-01 を Codex へ依頼する指示文

```md
次の 1 タスクだけ対応してください: `BOOT-01`

守ること:
- 対応対象は `BOOT-01` のみ
- モノレポ基本構成の作成以外は進めない
- TypeScript / ESLint / Prettier の詳細設定は `BOOT-02` に送る
- `.env.example` 整備は `BOOT-03` に送る
- 差分は最小にする

まず最初に以下を出力してください。
- Task
- Depends on
- Read docs
- In scope
- Out of scope
- Checks planned

完了時は以下を必ず出力してください。
- Task
- Status
- Changed files
- Checks
- Notes
- Next

Done 条件:
- npm workspaces が設定されている
- ルート scripts が定義されている
- `apps/web`, `apps/api`, `packages/shared` の package.json がある
- `npm install` が通る
```

### 7-12. 具体例: PRODUCT-05B を Codex へ依頼する指示文

```md
次の 1 タスクだけ対応してください: `PRODUCT-05B`

前提:
- `PRODUCT-05A` が完了していること
- 今回は商品更新 API の主責務だけを実装する
- 商品詳細UIや画像アップロードUIには広げない

今回の必須対応:
- `PUT /api/products/:productId` を実装する
- `soldAt` の更新ルールを実装する
- `primaryImageId` を受け取り、検証する
- `primaryImageId` を `images[].isPrimary` に正規化する
- 未送信または不正な `primaryImageId` は仕様どおり扱う

やらないこと:
- 商品詳細画面のUI更新
- 画像追加 / 差し替え / 削除API
- 代表画像選択UI

開始時に必ず出力:
- Task
- Depends on
- Read docs
- In scope
- Out of scope
- Checks planned

完了時に必ず出力:
- Task
- Status
- Changed files
- Checks
- Notes
- Next
```

---

## 8. 備考

- まずは **商品管理の縦断実装** を最優先とする
- 画像、QR、ダッシュボードは商品基盤完成後に着手する
- 迷った場合は、設計優先順位に従う
  1. `requirements.md`
  2. `basic_design.md`
  3. `detail_design.md`
  4. `api_specification.md`
  5. `data_design.md`
  6. `screen_design.md`
  7. `implementation-notes.md`
