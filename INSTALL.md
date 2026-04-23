# Codex 配置手順

このフォルダは、既存リポジトリのルートに**重ねて配置するための最小セット**です。

## 配置先
- `AGENTS.md` → リポジトリルート
- `.codex/skills/handmade-sales-manager/` → リポジトリ配下

## 想定配置後
```text
<repo-root>/
├── AGENTS.md
├── .codex/
│   └── skills/
│       └── handmade-sales-manager/
│           ├── SKILL.md
│           ├── metadata.json
│           ├── resources/
│           ├── examples/
│           └── templates/
├── apps/
├── packages/
├── docs/
└── firebase/
```

## 使い方
1. このフォルダ内の内容を、対象リポジトリのルートへコピーする
2. 既存の `AGENTS.md` がある場合は内容差分を確認して統合する
3. Codex / VS Code 拡張機能からリポジトリを開く

## 補足
- 実質的なスキル本体は `.codex/skills/handmade-sales-manager/SKILL.md` です
- `metadata.json` や `resources/` は補助ファイルです
- `AGENTS.md` が Codex 向けの正本です
