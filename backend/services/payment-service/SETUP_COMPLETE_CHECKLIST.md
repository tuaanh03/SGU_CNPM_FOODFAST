# ✅ Payment Service - Prisma Models Setup Complete

## 🎉 Hoàn thành tạo 2 Prisma models cho Payment Service!

---

## ✨ Đã tạo được:

### 1. **PaymentIntent Model** (`payment_intents` table)
- ✅ Lưu thông tin ý định thanh toán của order
- ✅ Mỗi order có 1 PaymentIntent (orderId UNIQUE)
- ✅ Soft reference đến Order (không có FK vì microservices)
- ✅ Status enum: REQUIRES_PAYMENT, PROCESSING, SUCCEEDED, FAILED, CANCELED
- ✅ Metadata field cho flexibility
- ✅ Proper indexes cho performance

### 2. **PaymentAttempt Model** (`payment_attempts` table)
- ✅ Lưu từng lần thử thanh toán (có thể nhiều attempts cho 1 intent)
- ✅ Foreign key relation đến PaymentIntent (CASCADE delete)
- ✅ Status enum: CREATED, PROCESSING, SUCCEEDED, FAILED, CANCELED
- ✅ PSPProvider enum: VNPAY, MOMO, ZALOPAY, STRIPE
- ✅ VNPay fields: vnpTxnRef, vnpTransactionNo, vnpResponseCode, vnpBankCode
- ✅ Raw payloads: vnpRawRequestPayload, vnpRawResponsePayload
- ✅ Metadata field cho additional info
- ✅ Multiple indexes cho query performance

---

## 📁 Files Created/Updated

### ✅ Created:
1. `prisma/schema.prisma` - Main Prisma schema
2. `prisma/schema.sql` - Reference SQL structure
3. `src/lib/prisma.ts` - Prisma Client singleton
4. `PRISMA_SCHEMA_GUIDE.md` - Complete guide with examples
5. `SCHEMA_COMPARISON.md` - Comparison with original SQL
6. `SETUP_COMPLETE_CHECKLIST.md` - This file

### 🔄 Updated:
1. `package.json` - Added Prisma dependencies and scripts
2. `.env.example` - Added DATABASE_URL configuration

---

## 🎯 Key Improvements từ SQL ban đầu

| Feature | SQL Ban đầu | Prisma Schema | Better? |
|---------|-------------|---------------|---------|
| order_id type | BIGINT | String (UUID) | ✅ Matches order-service |
| FK to orders | Yes | No (soft ref) | ✅ Microservices pattern |
| Status fields | VARCHAR(50) | Enum | ✅ Type-safe |
| PSP provider | VARCHAR(50) | Enum | ✅ Type-safe |
| Indexes | 1 | 4+ per table | ✅ Better performance |
| Metadata | No | Yes (JSON) | ✅ More flexible |
| Bank code | No | Yes | ✅ Better tracking |
| TypeScript | Manual | Auto-generated | ✅ Better DX |
| Cascade delete | Not specified | Yes | ✅ Data integrity |

---

## 🚀 Bước tiếp theo (TODO):

### 1. Install Dependencies
```bash
cd backend/services/payment-service
npm install
# hoặc
pnpm install
```

### 2. Setup Database URL
Thêm vào file `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/payment_db?schema=public
```

### 3. Generate Prisma Client
```bash
npm run prisma:generate
```
Lệnh này sẽ:
- Generate TypeScript types
- Create Prisma Client
- Enable auto-complete

### 4. Run First Migration
```bash
npm run prisma:migrate
```
Khi được hỏi migration name, có thể đặt: `init_payment_schema`

Lệnh này sẽ:
- Create migration files
- Apply migration to database
- Create `payment_intents` và `payment_attempts` tables

### 5. (Optional) Open Prisma Studio
```bash
npm run prisma:studio
```
Xem và edit data trong browser UI

---

## 💻 Quick Start Code

### Import Prisma Client
```typescript
import prisma from "../lib/prisma";
```

### Create Payment Intent
```typescript
const intent = await prisma.paymentIntent.create({
  data: {
    orderId: "order-uuid-123",
    amount: 100000, // 100,000 VND
    currency: "VND",
    status: "REQUIRES_PAYMENT",
    metadata: {
      userId: "user-uuid",
      items: [...orderItems],
    },
  },
});
```

### Create Payment Attempt
```typescript
const txnRef = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const attempt = await prisma.paymentAttempt.create({
  data: {
    paymentIntentId: intent.id,
    status: "CREATED",
    amount: intent.amount,
    currency: "VND",
    pspProvider: "VNPAY",
    vnpTxnRef: txnRef,
    vnpRawRequestPayload: {
      vnp_Amount: intent.amount * 100,
      vnp_OrderInfo: `Order ${intent.orderId}`,
      // ... other VNPay params
    },
  },
});
```

### Update After VNPay Callback
```typescript
// Find by vnpTxnRef
const attempt = await prisma.paymentAttempt.findUnique({
  where: { vnpTxnRef: req.query.vnp_TxnRef },
  include: { paymentIntent: true },
});

// Update in transaction
await prisma.$transaction([
  prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "SUCCEEDED",
      vnpResponseCode: req.query.vnp_ResponseCode,
      vnpTransactionNo: req.query.vnp_TransactionNo,
      vnpBankCode: req.query.vnp_BankCode,
      vnpRawResponsePayload: req.query,
    },
  }),
  prisma.paymentIntent.update({
    where: { id: attempt.paymentIntentId },
    data: { status: "SUCCEEDED" },
  }),
]);
```

### Query Payment with Attempts
```typescript
const payment = await prisma.paymentIntent.findUnique({
  where: { orderId: "order-uuid-123" },
  include: {
    attempts: {
      orderBy: { createdAt: "desc" },
    },
  },
});
```

---

## 📊 Database Structure

```
┌──────────────────────┐
│  PaymentIntent       │
├──────────────────────┤
│ id (PK)              │
│ orderId (UNIQUE)     │────→ (soft ref) Order in order-service
│ amount               │
│ currency             │
│ status (enum)        │
│ metadata (JSON)      │
│ createdAt            │
│ updatedAt            │
└──────────────────────┘
         │ 1
         │
         │ has many
         │
         │ N
         ▼
┌──────────────────────┐
│  PaymentAttempt      │
├──────────────────────┤
│ id (PK)              │
│ paymentIntentId (FK) │
│ status (enum)        │
│ amount               │
│ currency             │
│ pspProvider (enum)   │
│ vnpTxnRef (UNIQUE)   │
│ vnpTransactionNo     │
│ vnpResponseCode      │
│ vnpBankCode          │
│ vnpRawRequestPayload │
│ vnpRawResponsePayload│
│ metadata (JSON)      │
│ createdAt            │
│ updatedAt            │
└──────────────────────┘
```

---

## 🎨 TypeScript Types Auto-Generated

Sau khi chạy `prisma generate`, bạn có thể dùng:

```typescript
import { PaymentIntent, PaymentAttempt, PaymentIntentStatus, PSPProvider } from "@prisma/client";

// Type-safe function
async function createPayment(
  orderId: string,
  amount: number
): Promise<PaymentIntent> {
  return await prisma.paymentIntent.create({
    data: {
      orderId,
      amount,
      currency: "VND",
      status: "REQUIRES_PAYMENT", // Auto-complete available!
    },
  });
}
```

---

## 📚 Documentation

1. **PRISMA_SCHEMA_GUIDE.md**
   - Complete setup instructions
   - Usage examples
   - Payment flow examples
   - Best practices

2. **SCHEMA_COMPARISON.md**
   - Original SQL vs Prisma comparison
   - Explains all changes
   - Migration guidance

3. **STRUCTURE_COMPARISON.md**
   - Service structure before/after refactor

4. **RESTRUCTURE_SUMMARY.md**
   - Service restructuring details

---

## ✅ Final Checklist

- [x] Created Prisma schema with 2 models
- [x] Added proper enums for type safety
- [x] Added indexes for performance
- [x] Created Prisma client singleton
- [x] Updated package.json with dependencies
- [x] Updated .env.example
- [x] Created documentation
- [x] Fixed JSON formatting
- [ ] **TODO: Run `npm install`**
- [ ] **TODO: Run `npm run prisma:generate`**
- [ ] **TODO: Run `npm run prisma:migrate`**
- [ ] **TODO: Update controllers to use Prisma**
- [ ] **TODO: Test payment flow**

---

## 🎉 Kết luận

Payment service giờ đã có:

✅ **Database Schema** - 2 models với proper relations
✅ **Type Safety** - Enums và auto-generated types
✅ **Documentation** - Complete guides
✅ **Performance** - Proper indexes
✅ **Flexibility** - Metadata fields
✅ **Audit Trail** - Raw payload storage
✅ **Multi-PSP** - Support multiple payment providers
✅ **Microservices-friendly** - No cross-database FK

**Schema đã sẵn sàng! Chỉ cần chạy migration và bắt đầu code! 🚀**

