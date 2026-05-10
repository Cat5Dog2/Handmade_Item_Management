import type { ProductStatus } from "@handmade/shared";
import { PRODUCT_STATUSES, normalizeSearchKeyword } from "@handmade/shared";

export const DEFAULT_DEMO_SEED_COUNT = 25;
export const MAX_DEMO_SEED_COUNT = 100;
export const DEFAULT_DEMO_OWNER_PASSWORD = "password123";

const BASE_CREATED_AT = Date.UTC(2026, 0, 10, 9, 0, 0);

export interface DemoCategoryDocument {
  categoryId: string;
  createdAt: Date;
  name: string;
  sortOrder: number;
  updatedAt: Date;
}

export interface DemoTagDocument {
  tagId: string;
  createdAt: Date;
  name: string;
  updatedAt: Date;
}

interface DemoCustomerSnsAccountDocument {
  accountName: string | null;
  note: string | null;
  platform: string | null;
  url: string | null;
}

export interface DemoCustomerDocument {
  ageGroup: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  customerId: string;
  customerStyle: string | null;
  gender: string | null;
  isArchived: boolean;
  memo: string | null;
  name: string;
  normalizedName: string;
  snsAccounts: DemoCustomerSnsAccountDocument[];
  updatedAt: Date;
}

interface DemoProductImageDocument {
  displayPath: string;
  imageId: string;
  isPrimary: boolean;
  sortOrder: number;
  thumbnailPath: string;
}

export interface DemoProductDocument {
  categoryId: string;
  createdAt: Date;
  deletedAt: Date | null;
  description: string;
  images: DemoProductImageDocument[];
  isDeleted: boolean;
  name: string;
  price: number;
  productId: string;
  qrCodeValue: string;
  soldAt: Date | null;
  soldCustomerId: string | null;
  soldCustomerNameSnapshot: string | null;
  status: ProductStatus;
  tagIds: string[];
  updatedAt: Date;
}

export interface DemoTaskDocument {
  completedAt: Date | null;
  content: string;
  createdAt: Date;
  dueDate: string | null;
  isCompleted: boolean;
  memo: string;
  name: string;
  productId: string;
  taskId: string;
  updatedAt: Date;
}

export interface DemoCounterDocument {
  counterKey: "product" | "customer";
  currentValue: number;
  updatedAt: Date;
}

export interface DemoSeedMetadataDocument {
  categories: number;
  customers: number;
  products: number;
  seedKey: "docker-demo-v1";
  tags: number;
  tasks: number;
  updatedAt: Date;
}

export interface DemoSeedData {
  categories: DemoCategoryDocument[];
  counters: DemoCounterDocument[];
  customers: DemoCustomerDocument[];
  metadata: DemoSeedMetadataDocument;
  products: DemoProductDocument[];
  tags: DemoTagDocument[];
  tasks: DemoTaskDocument[];
}

function pad(value: number, digits: number) {
  return String(value).padStart(digits, "0");
}

function createdAtFor(index: number) {
  return new Date(BASE_CREATED_AT + index * 60 * 60 * 1000);
}

function productIdFor(index: number) {
  return `HM-${pad(index, 6)}`;
}

function customerIdFor(index: number) {
  return `cus_${pad(index, 6)}`;
}

function categoryIdFor(index: number) {
  return `cat_demo_${pad(index, 3)}`;
}

function tagIdFor(index: number) {
  return `tag_demo_${pad(index, 3)}`;
}

function taskIdFor(index: number) {
  return `task_demo_${pad(index, 3)}`;
}

function buildCategories(count: number): DemoCategoryDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const createdAt = createdAtFor(index);

    return {
      categoryId: categoryIdFor(index),
      createdAt,
      name: `Demo Category ${pad(index, 2)}`,
      sortOrder: index,
      updatedAt: createdAt
    };
  });
}

function buildTags(count: number): DemoTagDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const createdAt = createdAtFor(index);

    return {
      tagId: tagIdFor(index),
      createdAt,
      name: `Demo Tag ${pad(index, 2)}`,
      updatedAt: createdAt
    };
  });
}

function buildCustomers(count: number): DemoCustomerDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const createdAt = createdAtFor(index);
    const name = `Demo Customer ${pad(index, 2)}`;

    return {
      ageGroup: ["20s", "30s", "40s", "50s"][index % 4],
      archivedAt: null,
      createdAt,
      customerId: customerIdFor(index),
      customerStyle: ["Natural", "Simple", "Colorful", "Classic"][index % 4],
      gender: [null, "female", "male"][index % 3],
      isArchived: false,
      memo: `Demo customer memo ${pad(index, 2)}`,
      name,
      normalizedName: normalizeSearchKeyword(name),
      snsAccounts: [
        {
          accountName: `demo_customer_${pad(index, 2)}`,
          note: "Local demo account",
          platform: "Instagram",
          url: `https://example.com/demo_customer_${pad(index, 2)}`
        }
      ],
      updatedAt: createdAt
    };
  });
}

function buildProducts(count: number): DemoProductDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const productId = productIdFor(index);
    const status = PRODUCT_STATUSES[arrayIndex % PRODUCT_STATUSES.length];
    const createdAt = createdAtFor(index);
    const soldAt = status === "sold" ? createdAt : null;
    const soldCustomerIndex = ((index - 1) % count) + 1;
    const soldCustomerNameSnapshot =
      status === "sold" ? `Demo Customer ${pad(soldCustomerIndex, 2)}` : null;

    return {
      categoryId: categoryIdFor(((index - 1) % count) + 1),
      createdAt,
      deletedAt: null,
      description: [
        `Local demo product ${pad(index, 2)}.`,
        "Use it for list, search, dashboard, QR lookup, and customer purchase checks."
      ].join("\n"),
      images: [],
      isDeleted: false,
      name: `Demo Handmade Item ${pad(index, 3)}`,
      price: 1200 + index * 180,
      productId,
      qrCodeValue: productId,
      soldAt,
      soldCustomerId:
        status === "sold" ? customerIdFor(soldCustomerIndex) : null,
      soldCustomerNameSnapshot,
      status,
      tagIds: [
        tagIdFor(((index - 1) % count) + 1),
        tagIdFor((index % count) + 1)
      ],
      updatedAt: createdAt
    };
  });
}

function buildTasks(count: number): DemoTaskDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const createdAt = createdAtFor(index);
    const isCompleted = index % 4 === 0;

    return {
      completedAt: isCompleted ? createdAt : null,
      content: `Prepare local demo workflow for product ${productIdFor(index)}.`,
      createdAt,
      dueDate: `2026-02-${pad(((index - 1) % 28) + 1, 2)}`,
      isCompleted,
      memo: `Demo task memo ${pad(index, 2)}`,
      name: `Demo Task ${pad(index, 2)}`,
      productId: productIdFor(index),
      taskId: taskIdFor(index),
      updatedAt: createdAt
    };
  });
}

export function resolveDemoSeedCount(value: string | undefined) {
  if (!value) {
    return DEFAULT_DEMO_SEED_COUNT;
  }

  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1 ||
    parsedValue > MAX_DEMO_SEED_COUNT
  ) {
    return DEFAULT_DEMO_SEED_COUNT;
  }

  return parsedValue;
}

export function buildDemoSeedData(
  count = DEFAULT_DEMO_SEED_COUNT
): DemoSeedData {
  const updatedAt = createdAtFor(count + 1);

  return {
    categories: buildCategories(count),
    counters: [
      {
        counterKey: "product",
        currentValue: count,
        updatedAt
      },
      {
        counterKey: "customer",
        currentValue: count,
        updatedAt
      }
    ],
    customers: buildCustomers(count),
    metadata: {
      categories: count,
      customers: count,
      products: count,
      seedKey: "docker-demo-v1",
      tags: count,
      tasks: count,
      updatedAt
    },
    products: buildProducts(count),
    tags: buildTags(count),
    tasks: buildTasks(count)
  };
}
