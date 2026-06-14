import type { ProductStatus } from "@handmade/shared";
import { PRODUCT_STATUSES, normalizeSearchKeyword } from "@handmade/shared";

export const DEFAULT_DEMO_SEED_COUNT = 30;
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
  isCustomOrder: boolean;
  isLimitedStock: boolean;
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

const CATEGORY_NAMES = [
  "アクセサリー",
  "バッグ・財布",
  "インテリア雑貨",
  "アパレル",
  "スマホケース",
  "ステーショナリー",
  "その他"
];

function buildCategories(count: number): DemoCategoryDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const createdAt = createdAtFor(index);
    const name = arrayIndex < CATEGORY_NAMES.length ? CATEGORY_NAMES[arrayIndex] : `${CATEGORY_NAMES[arrayIndex % CATEGORY_NAMES.length]} ${index}`;

    return {
      categoryId: categoryIdFor(index),
      createdAt,
      name,
      sortOrder: index,
      updatedAt: createdAt
    };
  });
}

const TAG_NAMES = [
  "新作", "ギフト向け", "限定品", "オーダーメイド可", "アレルギー対応", 
  "定番人気", "再販", "一点物", "サージカルステンレス", "帆布",
  "春物", "夏物", "秋物", "冬物", "母の日",
  "父の日", "クリスマス", "敬老の日", "ハロウィン", "福袋",
  "アンティーク風", "ナチュラル", "シンプル", "個性的", "メンズ",
  "キッズ", "ベビー", "送料無料", "セール", "B品"
];

function buildTags(count: number): DemoTagDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const createdAt = createdAtFor(index);
    const name = arrayIndex < TAG_NAMES.length ? TAG_NAMES[arrayIndex] : `タグ ${index}`;

    return {
      tagId: tagIdFor(index),
      createdAt,
      name,
      updatedAt: createdAt
    };
  });
}

const CUSTOMER_NAMES = [
  "佐藤 美咲", "鈴木 健太", "高橋 陽子", "田中 裕子", "伊藤 香織",
  "渡辺 麻衣", "山本 ゆかり", "中村 翔太", "小林 真由美", "加藤 恵",
  "吉田 さくら", "山田 太郎", "佐々木 結衣", "山口 莉緒", "松本 彩",
  "井上 はるか", "木村 拓哉", "林 健一", "清水 香", "山崎 美穂",
  "森 慎太郎", "池田 恵理", "橋本 愛", "阿部 翔", "石川 琴音",
  "山下 智久", "中島 美嘉", "石井 竜也", "小川 直也", "前田 敦子"
];

const CUSTOMER_MEMOS = [
  "前回のマルシェで購入。金属アレルギーあり。",
  "青系のアクセサリーがお好き。",
  "ギフト用の購入が多い。",
  "いつもInstagramを見てくれている。",
  "サイズ直しを依頼されたことがある。",
  "シンプルで大人っぽいデザインを好まれる。",
  "ご友人のプレゼント用に購入。",
  "秋冬物の新作に興味あり。",
  "リピーター様。いつも丁寧なメッセージをくださる。",
  "オーダーメイドの相談あり。"
];

function buildCustomers(count: number): DemoCustomerDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const createdAt = createdAtFor(index);
    const name = arrayIndex < CUSTOMER_NAMES.length ? CUSTOMER_NAMES[arrayIndex] : `顧客 ${index}`;

    return {
      ageGroup: ["20s", "30s", "40s", "50s"][index % 4],
      archivedAt: null,
      createdAt,
      customerId: customerIdFor(index),
      customerStyle: ["Natural", "Simple", "Colorful", "Classic"][index % 4],
      gender: [null, "female", "male"][index % 3],
      isArchived: false,
      memo: CUSTOMER_MEMOS[arrayIndex % CUSTOMER_MEMOS.length],
      name,
      normalizedName: normalizeSearchKeyword(name),
      snsAccounts: [
        {
          accountName: `user_${pad(index, 4)}`,
          note: "Instagramアカウント",
          platform: "Instagram",
          url: `https://instagram.com/user_${pad(index, 4)}`
        }
      ],
      updatedAt: createdAt
    };
  });
}

const PRODUCT_NAMES = [
  "星空のレジンネックレス", "帆布のバイカラートート", "アロマキャンドル（ラベンダー）", "真鍮のアンティーク風リング", "かすみ草のガラスドームピアス",
  "本革のコンパクト財布", "リネン100%のエプロンワンピース", "ドライフラワーのスワッグ", "手染め糸のタッセルイヤリング", "猫モチーフの陶器ブローチ",
  "天然石のワイヤーブレスレット", "ボタニカル柄のスマホケース", "オーガニックコットンのベビー用スタイ", "木製カッティングボード", "マクラメ編みのタペストリー",
  "水引のポチ袋セット", "レトロなガラスビーズのヘアゴム", "手織りのウールマフラー", "押し花のクリアスマホリング", "サージカルステンレスのチェーンネックレス",
  "レザーのキーケース", "帆布のサコッシュ", "アシンメトリーなシルバーピアス", "ミモザの刺繍ブローチ", "アロマワックスサシェ（ローズ）",
  "ヴィンテージボタンのバレッタ", "コットンパールのネックレス", "幾何学模様のクッションカバー", "和柄の御朱印帳入れ", "シーグラスの涼しげなピアス"
];

function buildProducts(count: number): DemoProductDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const productId = productIdFor(index);
    const status = PRODUCT_STATUSES[arrayIndex % PRODUCT_STATUSES.length];
    const createdAt = createdAtFor(index);
    const soldAt = status === "sold" ? createdAt : null;
    const soldCustomerIndex = ((index - 1) % count) + 1;
    const customerName = (soldCustomerIndex - 1) < CUSTOMER_NAMES.length 
      ? CUSTOMER_NAMES[soldCustomerIndex - 1] 
      : `顧客 ${soldCustomerIndex}`;
    const soldCustomerNameSnapshot = status === "sold" ? customerName : null;
    const productName = arrayIndex < PRODUCT_NAMES.length ? PRODUCT_NAMES[arrayIndex] : `商品 ${index}`;

    return {
      categoryId: categoryIdFor(((index - 1) % count) + 1),
      createdAt,
      deletedAt: null,
      description: "ハンドメイドの温かみが感じられる一品です。\n丁寧に心を込めて制作しました。\n\n【素材】\nサージカルステンレス、レジン\n\n【サイズ】\n約40cm\n\n※ ハンドメイド作品のため、一点一点個体差がございます。",
      images: [],
      isCustomOrder: index % 5 === 0,
      isLimitedStock: index % 7 === 0,
      isDeleted: false,
      name: productName,
      price: 1500 + (index % 10) * 500,
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

const TASK_NAMES = [
  "金具をイヤリングに変更", "ギフトラッピング", "サイズ直し", "発送準備", "再販用の材料発注", 
  "Instagram用の写真撮影", "お客様への発送連絡", "梱包資材の補充", "入金確認", "オーダー詳細の確認"
];

function buildTasks(count: number): DemoTaskDocument[] {
  return Array.from({ length: count }, (_, arrayIndex) => {
    const index = arrayIndex + 1;
    const createdAt = createdAtFor(index);
    const isCompleted = index % 4 === 0;
    const taskName = TASK_NAMES[arrayIndex % TASK_NAMES.length];

    return {
      completedAt: isCompleted ? createdAt : null,
      content: `${taskName}の作業を行います。漏れのないよう注意。`,
      createdAt,
      dueDate: `2026-02-${pad(((index - 1) % 28) + 1, 2)}`,
      isCompleted,
      memo: isCompleted ? "対応完了しました" : "急ぎで対応する",
      name: taskName,
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
