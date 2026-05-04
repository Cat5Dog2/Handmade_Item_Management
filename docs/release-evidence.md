# リリース判定エビデンス

記録日: 2026-05-04

## 1. 確認対象
- `docs/test_design.md`
- `docs/test_cases.md`
- `README.md`
- `docs/implementation-notes.md`

## 2. 確認結果
- `docs/test_design.md` は主要機能と異常系の観点を含んでいる。
- `docs/test_cases.md` はログイン、ダッシュボード、商品、画像、タスク、カテゴリ、タグ、顧客、QR、主要ログ、非機能確認を含んでいる。
- `README.md` は現行実装と整合する MVP 対象と対象外を示している。
- `docs/implementation-notes.md` では、ひらがな / カタカナの相互吸収を MVP 未対応として明記している。

## 3. 実施済み確認
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build:web`
- `npm run build:api`
- `npm run build`
- `git diff --check`
- `npm audit --omit=dev --audit-level=moderate` は 2026-05-04 時点で low 2 件 / moderate 8 件が残存する。`firebase-admin@13.8.0` が最新版で、非破壊な `npm audit fix --omit=dev` では解消不可のため `docs/implementation-notes.md` 15.3 に判断を記録した。
- Firebase Emulator 起動確認: Auth `9099` / Firestore `8081` / Storage `9199` / Hosting `5000`
- Hosting root `http://127.0.0.1:5000/` の疎通確認

## 4. Next Phase
- ひらがな / カタカナの相互吸収
