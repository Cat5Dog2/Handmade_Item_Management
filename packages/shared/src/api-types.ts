import type { ApiErrorCode } from "./error-codes";
import type { ProductStatus } from "./statuses";

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiSuccessResponse<TData, TMeta = undefined> {
  data: TData;
  meta?: TMeta;
}

export interface HealthResponseData {
  status: "ok";
  service: string;
}

export interface AuthContext {
  actorUid: string;
  email: string;
}

export interface ProductListMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  hasNext: boolean;
}

export interface ProductImageSummary {
  imageId: string;
  displayPath: string;
  thumbnailPath: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductSummary {
  productId: string;
  name: string;
  status: ProductStatus;
  categoryId: string | null;
  categoryName: string | null;
  tagIds: string[];
  tagNames: string[];
  soldAt: string | null;
  updatedAt: string;
  images: ProductImageSummary[];
}
