# handmade-sales-manager-codex-skill

ハンドメイド在庫・販売管理アプリ向けの Codex / Agent Skills 用フォルダ構成一式です。

## 含まれるもの
- `SKILL.md`: スキル本体
- `metadata.json`: スキル名・説明・推奨タグなどの補助メタ情報
- `resources/`: Codex が迷いやすい判断を短くまとめた補助資料
- `examples/`: スキル呼び出し時の依頼例
- `templates/`: 作業依頼テンプレート、作業結果レポートテンプレート

## 想定用途
- VS Code 拡張機能の Codex で、このプロジェクトの実装・修正・調査を安定して行う
- 設計書優先順位、MVP 制約、API 経由原則、画像/QR/論理削除ルールを毎回説明しなくて済むようにする

## 置き方の目安
### リポジトリ直下に置く場合
```text
/AGENTS.md
/.codex/skills/handmade-sales-manager-codex-skill/
  SKILL.md
  metadata.json
  resources/...
```

### 個人用のスキル保管場所に置く場合
任意のスキルディレクトリへそのまま配置してください。

## 使い方の例
- 「このスキルを使って、商品一覧APIのフィルタ挙動を設計書準拠で修正して」
- 「このスキルで、商品画像削除時の代表画像切替を見直して」
- 「このスキルを使って、QR販売済更新のバリデーション差分を洗い出して」

## 補足
- `metadata.json` は補助ファイルです。実質的な本体は `SKILL.md` です。
- 補助資料は元の設計書を置き換えるものではなく、読む順番と判断のショートカットです。
