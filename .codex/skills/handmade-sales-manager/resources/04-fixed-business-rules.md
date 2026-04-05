# 固定業務ルール要約

## 商品
- 一点物として扱う
- 商品削除は論理削除
- `productId` は `HM-` + 6桁連番
- 論理削除済み商品は通常APIで参照不可

## ステータス
- `beforeProduction`
- `inProduction`
- `completed`
- `onDisplay`
- `inStock`
- `sold`

## 販売日時
- `sold` へ変更した時、`soldAt` 未設定なら現在時刻を設定
- 既に `soldAt` がある場合は上書きしない
- `sold` 以外へ戻す時は `soldAt = null`

## 画像
- 1商品最大10枚
- 対応形式: JPEG / PNG / WebP
- 10MB以下
- 表示用は長辺2000px、サムネイルは長辺400px程度
- 元画像は保持しない
- パスは次で固定
```text
products/{productId}/display/{imageId}.webp
products/{productId}/thumb/{imageId}.webp
```

## QR販売済更新
- 原則 `onDisplay` または `inStock` のみ販売済更新可
- 既に `sold` の商品は重複更新しない
