// Test setup for user-service
// Provide an in-memory fake Prisma client to be used in integration tests

const users = new Map<string, any>();
let idCounter = 1;

const fakePrisma = {
  user: {
    create: jest.fn(async ({ data, select }: any) => {
      const id = `user-${idCounter++}`;
      const now = new Date().toISOString();
      const user = {
        id,
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone,
        role: data.role || 'CUSTOMER',
        status: data.status || 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      users.set(user.email, user);
      if (select && typeof select === 'object') {
        const picked: any = {};
        for (const key of Object.keys(select)) picked[key] = (user as any)[key];
        return picked;
      }
      return user;
    }),

    findUnique: jest.fn(async ({ where }: any) => {
      if (!where) return null;
      // where may be like { email } or { email: { equals: x } } or { id }
      if (where.email) {
        const emailField = where.email;
        const emailVal = typeof emailField === 'object' ? (emailField.equals || null) : emailField;
        if (!emailVal) return null;
        return users.get(emailVal) ?? null;
      }
      if (where.id) {
        const idField = where.id;
        const idVal = typeof idField === 'object' ? (idField.equals || null) : idField;
        if (!idVal) return null;
        for (const u of users.values()) if (u.id === idVal) return u;
      }
      return null;
    }),

    findMany: jest.fn(async ({ where }: any) => {
      const res: any[] = [];
      for (const u of users.values()) res.push(u);
      return res;
    }),

    update: jest.fn(async ({ where, data }: any) => {
      // support where.email or where.id
      let user: any = null;
      if (where.email) {
        const emailField = where.email;
        const emailVal = typeof emailField === 'object' ? (emailField.equals || null) : emailField;
        user = users.get(emailVal) ?? null;
      } else if (where.id) {
        const idField = where.id;
        const idVal = typeof idField === 'object' ? (idField.equals || null) : idField;
        for (const u of users.values()) if (u.id === idVal) { user = u; break; }
      }
      if (!user) throw new Error('User not found');
      Object.assign(user, data);
      user.updatedAt = new Date().toISOString();
      users.set(user.email, user);
      return user;
    }),

    delete: jest.fn(async ({ where }: any) => {
      if (where.email) {
        const emailField = where.email;
        const emailVal = typeof emailField === 'object' ? (emailField.equals || null) : emailField;
        return users.delete(emailVal);
      }
      return false;
    }),

    deleteMany: jest.fn(async ({ where }: any) => {
      if (where && where.email && where.email.contains) {
        const substr = where.email.contains;
        let count = 0;
        for (const key of Array.from(users.keys())) {
          if (key.includes(substr)) {
            users.delete(key);
            count++;
          }
        }
        return { count };
      }
      // delete all
      const cnt = users.size;
      users.clear();
      return { count: cnt };
    }),
  },

  revokedToken: {
    findFirst: jest.fn(async (args: any) => null),
    create: jest.fn(async (args: any) => ({ ...args })),
  },

  // Prisma client lifecycle
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
  __reset: () => { users.clear(); idCounter = 1; }
};

// Allow cleanup after all tests
afterAll(async () => {
  // small delay to let async cleanup finish
  await new Promise((resolve) => setTimeout(resolve, 50));
});
