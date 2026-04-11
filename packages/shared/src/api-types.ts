import type { ApiErrorCode } from "./error-codes";
import type { ProductStatus } from "./statuses";

export type IsoDateString = string;
export type IsoDateTimeString = string;
export type SortOrder = "asc" | "desc";
export type ProductSortBy = "updatedAt" | "name";
export type QrLookupReasonCode =
  | "CAN_SELL"
  | "ALREADY_SOLD"
  | "INVALID_STATUS"
  | "PRODUCT_DELETED"
  | "PRODUCT_NOT_FOUND";

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
  urlExpiresAt?: IsoDateTimeString;
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

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  sortBy?: ProductSortBy;
  sortOrder?: SortOrder;
  keyword?: string;
  categoryId?: string;
  tagId?: string;
  status?: ProductStatus;
  includeSold?: boolean;
}

export interface ProductListItem {
  productId: string;
  name: string;
  status: ProductStatus;
  categoryName: string | null;
  updatedAt: IsoDateTimeString;
  thumbnailUrl: string | null;
}

export interface ProductListData {
  items: ProductListItem[];
}

export interface ProductBaseInput {
  name: string;
  price: number;
  categoryId: string;
  status: ProductStatus;
}

export interface ProductCreateInput extends ProductBaseInput {
  description?: string;
  tagIds?: string[];
}

export interface ProductUpdateInput extends ProductBaseInput {
  description: string;
  tagIds: string[];
  primaryImageId: string | null;
}

export interface ProductCreateData {
  productId: string;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ProductUpdateData {
  productId: string;
  updatedAt: IsoDateTimeString;
}

export interface ProductDeleteData {
  productId: string;
  deletedAt: IsoDateTimeString;
}

export interface ProductDetail {
  productId: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  categoryName: string;
  tagIds: string[];
  tagNames: string[];
  status: ProductStatus;
  soldAt: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ProductImageDetail {
  imageId: string;
  displayUrl: string;
  thumbnailUrl: string;
  urlExpiresAt: IsoDateTimeString;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductTasksSummary {
  openCount: number;
  completedCount: number;
}

export interface ProductDetailData {
  product: ProductDetail;
  images: ProductImageDetail[];
  tasksSummary: ProductTasksSummary;
  qrCodeValue: string;
}

export interface TaskItem {
  taskId: string;
  name: string;
  content: string;
  dueDate: IsoDateString | null;
  isCompleted: boolean;
  completedAt: IsoDateTimeString | null;
  memo: string;
  updatedAt: IsoDateTimeString;
}

export interface TaskListQuery {
  showCompleted?: boolean;
}

export interface TaskListData {
  items: TaskItem[];
}

export interface TaskCreateInput {
  name: string;
  content?: string;
  dueDate?: IsoDateString | null;
  memo?: string;
}

export interface TaskCreateData {
  taskId: string;
  updatedAt: IsoDateTimeString;
}

export interface TaskUpdateInput {
  name: string;
  content?: string;
  dueDate?: IsoDateString | null;
  memo?: string;
  isCompleted: boolean;
}

export interface TaskUpdateData {
  taskId: string;
  completedAt: IsoDateTimeString | null;
}

export interface TaskCompletionInput {
  isCompleted: boolean;
}

export interface TaskCompletionData {
  taskId: string;
  isCompleted: boolean;
  completedAt: IsoDateTimeString | null;
  updatedAt: IsoDateTimeString;
}

export interface TaskDeleteData {
  taskId: string;
}

export interface CategoryItem {
  categoryId: string;
  name: string;
  sortOrder: number;
  updatedAt: IsoDateTimeString;
  usedProductCount: number;
  isInUse: boolean;
}

export interface CategoryListData {
  items: CategoryItem[];
}

export interface CategoryInput {
  name: string;
  sortOrder?: number | null;
}

export interface CategoryMutationData {
  categoryId: string;
}

export interface TagItem {
  tagId: string;
  name: string;
  updatedAt: IsoDateTimeString;
  usedProductCount: number;
  isInUse: boolean;
}

export interface TagListData {
  items: TagItem[];
}

export interface TagInput {
  name: string;
}

export interface TagMutationData {
  tagId: string;
}

export type DashboardStatusCounts = Record<ProductStatus, number>;

export interface DashboardDueSoonTask {
  taskId: string;
  taskName: string;
  productId: string;
  productName: string;
  dueDate: IsoDateString;
}

export interface DashboardRecentProduct {
  productId: string;
  name: string;
  status: ProductStatus;
  updatedAt: IsoDateTimeString;
  thumbnailUrl: string | null;
}

export interface DashboardResponseData {
  statusCounts: DashboardStatusCounts;
  soldCount: number;
  openTaskCount: number;
  dueSoonTasks: DashboardDueSoonTask[];
  recentProducts: DashboardRecentProduct[];
}

export interface QrLookupInput {
  qrCodeValue: string;
}

export interface QrLookupData {
  productId: string;
  name: string;
  status: ProductStatus;
  canSell: boolean;
  reasonCode: QrLookupReasonCode;
  message: string;
}

export interface QrSellInput {
  productId?: string;
  qrCodeValue?: string;
}

export interface QrSellData {
  productId: string;
  status: "sold";
  soldAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
