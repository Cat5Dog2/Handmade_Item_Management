# ルーティング / API 要約

## 主要ルート
```text
/login
/dashboard
/products
/products/new
/products/:productId
/products/:productId/edit
/products/:productId/tasks
/categories
/tags
/qr
```

## 主要 API
- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/products`
- `POST /api/products`
- `GET /api/products/:productId`
- `PUT /api/products/:productId`
- `DELETE /api/products/:productId`
- `POST /api/products/:productId/images`
- `PUT /api/products/:productId/images/:imageId`
- `DELETE /api/products/:productId/images/:imageId`
- `GET /api/products/:productId/tasks`
- `POST /api/products/:productId/tasks`
- `PUT /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId/completion`
- `DELETE /api/tasks/:taskId`
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/:categoryId`
- `DELETE /api/categories/:categoryId`
- `GET /api/tags`
- `POST /api/tags`
- `PUT /api/tags/:tagId`
- `DELETE /api/tags/:tagId`
- `POST /api/qr/lookup`
- `POST /api/qr/sell`
