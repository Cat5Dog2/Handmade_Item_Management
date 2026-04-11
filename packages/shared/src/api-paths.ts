export const API_BASE_PATH = "/api";

export const API_PATHS = {
  health: `${API_BASE_PATH}/health`,
  dashboard: `${API_BASE_PATH}/dashboard`,
  products: `${API_BASE_PATH}/products`,
  categories: `${API_BASE_PATH}/categories`,
  tags: `${API_BASE_PATH}/tags`,
  tasks: `${API_BASE_PATH}/tasks`,
  qrLookup: `${API_BASE_PATH}/qr/lookup`,
  qrSell: `${API_BASE_PATH}/qr/sell`
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
