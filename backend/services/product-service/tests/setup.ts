// Test setup for product-service
// Provide an in-memory fake Prisma client to be used in integration tests

const products = new Map<string, any>();
let idCounter = 1;

// Add categories map for category operations used by tests
const categories = new Map<string, any>();
let categoryIdCounter = 1;

const fakePrisma = {
  product: {
    create: jest.fn(async ({ data, select }: any) => {
      const id = `product-${idCounter++}`;
      const now = new Date().toISOString();
      const product = {
        id,
        name: data.name,
        description: data.description,
        price: data.price,
        metadata: data.metadata || {},
        categoryId: data.categoryId || null,
        storeId: data.storeId || null,
        imageUrl: data.imageUrl,
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
        soldOutUntil: data.soldOutUntil,
        unavailableReason: data.unavailableReason,
        createdAt: now,
        updatedAt: now,
      };
      products.set(product.id, product);
      if (select && typeof select === 'object') {
        const picked: any = {};
        for (const key of Object.keys(select)) picked[key] = (product as any)[key];
        return picked;
      }
      return product;
    }),

    findUnique: jest.fn(async ({ where }: any) => {
      if (!where) return null;
      if (where.id) {
        const idField = where.id;
        const idVal = typeof idField === 'object' ? (idField.equals || null) : idField;
        return products.get(idVal) ?? null;
      }
      if (where.name) {
        // support { name: { equals: 'x' } } or name string
        const nameField = where.name;
        const nameVal = typeof nameField === 'object' ? (nameField.equals || null) : nameField;
        if (!nameVal) return null;
        for (const p of products.values()) if (p.name === nameVal) return p;
      }
      if (where.sku) {
        const skuField = where.sku;
        const skuVal = typeof skuField === 'object' ? (skuField.equals || null) : skuField;
        for (const p of products.values()) if (p.sku === skuVal) return p;
      }
      return null;
    }),

    findMany: jest.fn(async ({ where }: any) => {
      const res: any[] = [];
      for (const p of products.values()) res.push(p);
      if (where && where.storeId) return res.filter(r => r.storeId === where.storeId);
      if (where && where.categoryId) return res.filter(r => r.categoryId === where.categoryId);
      return res;
    }),

    update: jest.fn(async ({ where, data }: any) => {
      const idField = where.id;
      const idVal = typeof idField === 'object' ? (idField.equals || null) : idField;
      const product = products.get(idVal);
      if (!product) throw new Error('Product not found');
      Object.assign(product, data);
      product.updatedAt = new Date().toISOString();
      products.set(product.id, product);
      return product;
    }),

    delete: jest.fn(async ({ where }: any) => {
      const idField = where.id;
      const idVal = typeof idField === 'object' ? (idField.equals || null) : idField;
      return products.delete(idVal);
    }),

    deleteMany: jest.fn(async ({ where }: any) => {
      // support where: { name: { contains: 'test' } } or where: { storeId }
      if (where && where.name && where.name.contains) {
        const substr = where.name.contains;
        let count = 0;
        for (const [k, v] of Array.from(products.entries())) {
          if (v.name && v.name.includes(substr)) {
            products.delete(k);
            count++;
          }
        }
        return { count };
      }
      if (where && where.storeId) {
        let count = 0;
        for (const [k, v] of Array.from(products.entries())) {
          if (v.storeId === where.storeId) {
            products.delete(k);
            count++;
          }
        }
        return { count };
      }
      const cnt = products.size;
      products.clear();
      return { count: cnt };
    }),
  },

  // In-memory Category model to support tests that use prisma.category
  category: {
    create: jest.fn(async ({ data }: any) => {
      const id = `category-${categoryIdCounter++}`;
      const now = new Date().toISOString();
      const cat = { id, name: data.name, createdAt: now, updatedAt: now };
      categories.set(cat.id, cat);
      return cat;
    }),
    findUnique: jest.fn(async ({ where }: any) => {
      if (!where) return null;
      if (where.id) return categories.get(where.id) ?? null;
      if (where.name) {
        const nameField = where.name;
        const nameVal = typeof nameField === 'object' ? (nameField.equals || null) : nameField;
        for (const c of categories.values()) if (c.name === nameVal) return c;
      }
      return null;
    }),
    deleteMany: jest.fn(async ({ where }: any) => {
      if (where && where.id) {
        let count = 0;
        for (const [k, v] of Array.from(categories.entries())) {
          if (v.id === where.id) { categories.delete(k); count++; }
        }
        return { count };
      }
      const cnt = categories.size;
      categories.clear();
      return { count: cnt };
    }),
  },

  $connect: jest.fn(async () => {}),
  $disconnect: jest.fn(async () => {}),
};

// Provide the fake prisma via jest mock for imports of '../src/lib/prisma'
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: fakePrisma,
}));

// Provide a global fetch stub if anything calls fetch in tests
global.fetch = jest.fn();

// Expose helpers for tests
export const __testHelpers = {
  __reset: () => { products.clear(); idCounter = 1; categories.clear(); categoryIdCounter = 1; }
};

// Make helpers available globally so setupFilesAfterEnv can access them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).__testHelpers = __testHelpers;

// NOTE: do not call afterAll here because this file is loaded via `setupFiles`
// which runs before Jest sets up globals like `afterAll`. The teardown hook
// is registered in `tests/setupAfterEnv.ts` (loaded via setupFilesAfterEnv).
