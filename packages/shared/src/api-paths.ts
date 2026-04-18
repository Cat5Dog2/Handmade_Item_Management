const API_PATH_PREFIX = "";

export const API_PATHS = {
  authLoginRecord: `${API_PATH_PREFIX}/auth/login-record`,
  health: `${API_PATH_PREFIX}/health`,
  dashboard: `${API_PATH_PREFIX}/dashboard`,
  products: `${API_PATH_PREFIX}/products`,
  categories: `${API_PATH_PREFIX}/categories`,
  tags: `${API_PATH_PREFIX}/tags`,
  tasks: `${API_PATH_PREFIX}/tasks`,
  qrLookup: `${API_PATH_PREFIX}/qr/lookup`,
  qrSell: `${API_PATH_PREFIX}/qr/sell`
} as const;

export function getProductPath(productId: string) {
  return `${API_PATHS.products}/${productId}`;
}

export function getProductImagesPath(productId: string) {
  return `${getProductPath(productId)}/images`;
}

export function getProductImagePath(productId: string, imageId: string) {
  return `${getProductImagesPath(productId)}/${imageId}`;
}

export function getProductTasksPath(productId: string) {
  return `${getProductPath(productId)}/tasks`;
}

export function getTaskPath(taskId: string) {
  return `${API_PATHS.tasks}/${taskId}`;
}

export function getTaskCompletionPath(taskId: string) {
  return `${getTaskPath(taskId)}/completion`;
}

export function getCategoryPath(categoryId: string) {
  return `${API_PATHS.categories}/${categoryId}`;
}

export function getTagPath(tagId: string) {
  return `${API_PATHS.tags}/${tagId}`;
}
