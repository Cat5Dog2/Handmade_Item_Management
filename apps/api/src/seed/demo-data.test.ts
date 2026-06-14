import { PRODUCT_STATUSES } from "@handmade/shared";
import {
  DEFAULT_DEMO_SEED_COUNT,
  buildDemoSeedData,
  resolveDemoSeedCount
} from "./demo-data";

describe("demo seed data", () => {
  it("builds the requested number of core business documents", () => {
    const data = buildDemoSeedData();

    expect(data.categories).toHaveLength(DEFAULT_DEMO_SEED_COUNT);
    expect(data.tags).toHaveLength(DEFAULT_DEMO_SEED_COUNT);
    expect(data.customers).toHaveLength(DEFAULT_DEMO_SEED_COUNT);
    expect(data.products).toHaveLength(DEFAULT_DEMO_SEED_COUNT);
    expect(data.tasks).toHaveLength(DEFAULT_DEMO_SEED_COUNT);
  });

  it("keeps generated products aligned with MVP data rules", () => {
    const data = buildDemoSeedData(6);
    const product = data.products[0];
    const soldProduct = data.products.find(({ status }) => status === "sold");

    expect(product).toMatchObject({
      productId: "HM-000001",
      qrCodeValue: "HM-000001",
      images: [],
      isDeleted: false,
      deletedAt: null
    });
    expect(data.products.map(({ status }) => status)).toEqual(PRODUCT_STATUSES);
    expect(data.products.map(({ status }) => status)).not.toContain(
      "beforeProduction"
    );
    expect(data.products.map(({ status }) => status)).not.toContain(
      "onDisplay"
    );
    expect(soldProduct?.soldAt).toBeInstanceOf(Date);
    expect(soldProduct?.soldCustomerId).toMatch(/^cus_\d{6}$/);
    const soldCustomer = data.customers.find(
      ({ customerId }) => customerId === soldProduct?.soldCustomerId
    );
    expect(soldCustomer?.isArchived).toBe(false);
    expect(soldProduct?.soldCustomerNameSnapshot).toBe(soldCustomer?.name);
  });

  it("sets counters to the highest generated product and customer numbers", () => {
    const data = buildDemoSeedData(25);

    expect(data.counters).toEqual([
      expect.objectContaining({
        counterKey: "product",
        currentValue: 25
      }),
      expect.objectContaining({
        counterKey: "customer",
        currentValue: 25
      })
    ]);
  });

  it("falls back to the default count for invalid count settings", () => {
    expect(resolveDemoSeedCount(undefined)).toBe(DEFAULT_DEMO_SEED_COUNT);
    expect(resolveDemoSeedCount("0")).toBe(DEFAULT_DEMO_SEED_COUNT);
    expect(resolveDemoSeedCount("101")).toBe(DEFAULT_DEMO_SEED_COUNT);
    expect(resolveDemoSeedCount("abc")).toBe(DEFAULT_DEMO_SEED_COUNT);
    expect(resolveDemoSeedCount("12")).toBe(12);
  });
});
