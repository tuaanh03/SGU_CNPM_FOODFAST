# 🕐 ORDER SESSION MANAGEMENT

## Tổng quan

Order Session là cơ chế quản lý **thời gian sống** của một đơn hàng và cho phép:
- ⏰ **Tự động hủy** đơn hàng sau X phút nếu chưa thanh toán
- 🔄 **Retry payment** trong thời gian session còn hiệu lực
- 📊 **Tracking** số lần retry và trạng thái session

---

## Database Schema

### Enum OrderSessionStatus

```prisma
enum OrderSessionStatus {
  active    // Session đang hoạt động
  expired   // Session đã hết hạn
  completed // Thanh toán thành công
  cancelled // Đã hủy
}
```

### Model OrderSession

```prisma
model OrderSession {
  id      String @id @default(uuid())
  orderId String @unique // 1-1 relation với Order
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  status OrderSessionStatus @default(active)

  // Session timing
  sessionDurationMinutes Int      @default(15) // Thời gian session (mặc định 15 phút)
  expiresAt              DateTime // Thời điểm session hết hạn
  startedAt              DateTime @default(now())

  // Payment retry tracking
  paymentAttempts    Int      @default(0) // Số lần retry payment
  maxPaymentAttempts Int      @default(3) // Tối đa số lần retry
  lastPaymentAttempt DateTime? // Lần retry cuối cùng

  // Metadata
  metadata Json? // Lưu thông tin bổ sung (IP, user agent, etc.)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orderId])
  @@index([status, expiresAt]) // Query sessions cần expire
  @@index([expiresAt]) // Query cho background job
}
```

### Enum OrderStatus (Updated)

```prisma
enum OrderStatus {
  pending  // Đang chờ thanh toán
  success  // Thanh toán thành công
  failed   // Thanh toán thất bại
  expired  // Đơn hàng hết hạn (session timeout)
}
```

---

## Workflow với Session

### 1. Tạo Order (createOrderFromCart)

```
Client → POST /order/create-from-cart
  ↓
Order Service:
  1. Validate cart items
  2. Tạo Order (status: pending)
  3. ✨ Tạo OrderSession (duration: 15 phút)
  4. Calculate expiresAt = now + 15 minutes
  5. Publish event order.create (include sessionId, expiresAt)
  6. Return order + session info
```

**Response Example**:
```json
{
  "success": true,
  "message": "Đơn hàng đã được tạo ở trạng thái PENDING, đang xử lý thanh toán",
  "data": {
    "orderId": "order-uuid-123",
    "items": [...],
    "totalPrice": 65000,
    "status": "pending",
    "session": {
      "sessionId": "session-uuid",
      "expiresAt": "2025-10-29T10:45:00Z",
      "durationMinutes": 15,
      "status": "active"
    },
    "createdAt": "2025-10-29T10:30:00Z"
  }
}
```

### 2. Session Timeline

```
Time 0:00 - Order Created
├── Session starts (status: active)
├── expiresAt = now + 15 minutes
└── paymentAttempts = 0

Time 0:00-15:00 - Active Period
├── User có thể thanh toán
├── Có thể retry payment (max 3 lần)
└── Session status: active

Time 15:00 - Session Expires
├── Background job phát hiện session hết hạn
├── Update OrderSession.status = expired
├── Update Order.status = expired
└── Không thể thanh toán nữa
```

---

## API Endpoints (Chưa triển khai)

### GET `/order/session/:orderId`

Lấy thông tin session của order.

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session-uuid",
    "orderId": "order-uuid",
    "status": "active",
    "expiresAt": "2025-10-29T10:45:00Z",
    "remainingMinutes": 12.5,
    "paymentAttempts": 1,
    "maxPaymentAttempts": 3,
    "canRetry": true
  }
}
```

### POST `/order/retry-payment/:orderId`

Retry payment trong thời gian session còn active.

**Conditions**:
- Session status = "active"
- paymentAttempts < maxPaymentAttempts
- expiresAt > now

**Response Success**:
```json
{
  "success": true,
  "message": "Đang xử lý thanh toán lại",
  "data": {
    "orderId": "order-uuid",
    "paymentAttempts": 2,
    "paymentUrl": "https://sandbox.vnpayment.vn/..."
  }
}
```

**Response Failed (Session Expired)**:
```json
{
  "success": false,
  "message": "Phiên thanh toán đã hết hạn. Vui lòng tạo đơn hàng mới.",
  "error": "SESSION_EXPIRED"
}
```

**Response Failed (Max Attempts)**:
```json
{
  "success": false,
  "message": "Đã vượt quá số lần thanh toán cho phép (3 lần)",
  "error": "MAX_ATTEMPTS_REACHED"
}
```

---

## Background Job: Session Expiration

### Cron Job (Chưa triển khai)

Chạy mỗi 1 phút để kiểm tra và expire sessions:

```typescript
// utils/sessionExpireJob.ts
import cron from 'node-cron';
import prisma from '../lib/prisma';

// Chạy mỗi 1 phút
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    
    // Tìm các sessions đã hết hạn nhưng vẫn active
    const expiredSessions = await prisma.orderSession.findMany({
      where: {
        status: 'active',
        expiresAt: {
          lte: now // expiresAt <= now
        }
      },
      include: {
        order: true
      }
    });

    console.log(`Found ${expiredSessions.length} expired sessions`);

    // Cập nhật từng session
    for (const session of expiredSessions) {
      // Update session status
      await prisma.orderSession.update({
        where: { id: session.id },
        data: { status: 'expired' }
      });

      // Update order status nếu vẫn pending
      if (session.order.status === 'pending') {
        await prisma.order.update({
          where: { id: session.orderId },
          data: { status: 'expired' }
        });
      }

      console.log(`Expired order ${session.orderId} and session ${session.id}`);
    }
  } catch (error) {
    console.error('Error in session expiration job:', error);
  }
});
```

### Manual Check Query

```sql
-- Tìm sessions cần expire
SELECT 
  os.id as session_id,
  os."orderId",
  os.status as session_status,
  os."expiresAt",
  o.status as order_status,
  NOW() as current_time,
  (os."expiresAt" < NOW()) as should_expire
FROM "OrderSession" os
JOIN "Order" o ON os."orderId" = o.id
WHERE os.status = 'active'
  AND os."expiresAt" < NOW();
```

---

## Payment Retry Logic

### Function: retryPayment (Chưa triển khai)

```typescript
export const retryPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
      return;
    }

    // Lấy order và session
    const order = await prisma.order.findUnique({
      where: { id: orderId, userId },
      include: { session: true }
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found"
      });
      return;
    }

    const session = order.session;

    if (!session) {
      res.status(400).json({
        success: false,
        message: "No session found for this order"
      });
      return;
    }

    // Check 1: Session còn active không
    if (session.status !== 'active') {
      res.status(400).json({
        success: false,
        message: "Session is not active",
        error: "SESSION_NOT_ACTIVE"
      });
      return;
    }

    // Check 2: Session đã hết hạn chưa
    if (new Date() > session.expiresAt) {
      // Update session status
      await prisma.orderSession.update({
        where: { id: session.id },
        data: { status: 'expired' }
      });

      res.status(400).json({
        success: false,
        message: "Session has expired",
        error: "SESSION_EXPIRED"
      });
      return;
    }

    // Check 3: Đã vượt quá số lần retry chưa
    if (session.paymentAttempts >= session.maxPaymentAttempts) {
      res.status(400).json({
        success: false,
        message: `Maximum payment attempts (${session.maxPaymentAttempts}) reached`,
        error: "MAX_ATTEMPTS_REACHED"
      });
      return;
    }

    // Update payment attempts
    await prisma.orderSession.update({
      where: { id: session.id },
      data: {
        paymentAttempts: session.paymentAttempts + 1,
        lastPaymentAttempt: new Date()
      }
    });

    // Publish event để Payment Service tạo payment URL mới
    const retryPayload = {
      orderId: order.id,
      userId: order.userId,
      totalPrice: order.totalPrice,
      sessionId: session.id,
      retryAttempt: session.paymentAttempts + 1,
      timestamp: new Date().toISOString()
    };

    await publishEvent(JSON.stringify(retryPayload));

    res.status(200).json({
      success: true,
      message: "Payment retry initiated",
      data: {
        orderId: order.id,
        paymentAttempts: session.paymentAttempts + 1,
        maxPaymentAttempts: session.maxPaymentAttempts,
        remainingAttempts: session.maxPaymentAttempts - (session.paymentAttempts + 1)
      }
    });

  } catch (error: any) {
    console.error("Retry payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrying payment"
    });
  }
};
```

---

## Frontend Integration

### Display Session Timer

```javascript
// Component: OrderSessionTimer.jsx
import React, { useState, useEffect } from 'react';

const OrderSessionTimer = ({ expiresAt }) => {
  const [remainingTime, setRemainingTime] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires - now;

      if (diff <= 0) {
        setRemainingTime('Expired');
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="session-timer">
      <p>⏰ Thời gian còn lại: <strong>{remainingTime}</strong></p>
      {remainingTime === 'Expired' && (
        <p className="text-red-500">Phiên thanh toán đã hết hạn</p>
      )}
    </div>
  );
};
```

### Retry Payment Button

```javascript
const handleRetryPayment = async (orderId) => {
  try {
    const response = await axios.post(
      `/order/retry-payment/${orderId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.success) {
      // Poll for new payment URL
      pollPaymentUrl(orderId);
    }
  } catch (error) {
    if (error.response?.data?.error === 'SESSION_EXPIRED') {
      alert('Phiên thanh toán đã hết hạn. Vui lòng tạo đơn hàng mới.');
    } else if (error.response?.data?.error === 'MAX_ATTEMPTS_REACHED') {
      alert('Đã vượt quá số lần thanh toán cho phép.');
    }
  }
};
```

---

## Configuration

### Environment Variables

```env
# Order Service
ORDER_SESSION_DURATION_MINUTES=15  # Thời gian session mặc định
ORDER_SESSION_MAX_ATTEMPTS=3       # Số lần retry tối đa
SESSION_EXPIRE_JOB_INTERVAL=1      # Cron job interval (minutes)
```

### Customizable Session Duration

Có thể customize session duration cho từng order:

```typescript
// Đơn hàng thường: 15 phút
const normalSession = await createOrderSession(orderId, 15);

// Đơn hàng VIP: 30 phút
const vipSession = await createOrderSession(orderId, 30);

// Đơn hàng nhanh: 5 phút
const quickSession = await createOrderSession(orderId, 5);
```

---

## Database Queries

### Check Session Status

```sql
SELECT 
  o.id as order_id,
  o.status as order_status,
  os.id as session_id,
  os.status as session_status,
  os."expiresAt",
  os."paymentAttempts",
  os."maxPaymentAttempts",
  (os."expiresAt" > NOW()) as is_active,
  EXTRACT(EPOCH FROM (os."expiresAt" - NOW())) / 60 as remaining_minutes
FROM "Order" o
JOIN "OrderSession" os ON os."orderId" = o.id
WHERE o.id = 'your-order-id';
```

### Find Orders Pending with Active Sessions

```sql
SELECT 
  o.id,
  o."userId",
  o."totalPrice",
  o.status,
  os."expiresAt",
  os."paymentAttempts"
FROM "Order" o
JOIN "OrderSession" os ON os."orderId" = o.id
WHERE o.status = 'pending'
  AND os.status = 'active'
  AND os."expiresAt" > NOW();
```

### Orders Expired Today

```sql
SELECT 
  o.id,
  o."createdAt",
  os."expiresAt",
  o."totalPrice"
FROM "Order" o
JOIN "OrderSession" os ON os."orderId" = o.id
WHERE o.status = 'expired'
  AND DATE(os."expiresAt") = CURRENT_DATE;
```

---

## Summary

✅ **OrderSession model** đã được thêm vào schema  
✅ **createOrder** và **createOrderFromCart** tạo session tự động  
✅ Session mặc định: **15 phút**  
✅ Tracking: **paymentAttempts** (max 3 lần)  
✅ Response bao gồm: **sessionId, expiresAt, status**  

### Chưa triển khai (Next Steps):
- ⏳ Background job tự động expire sessions
- 🔄 API endpoint retry payment
- 📊 API endpoint check session status
- ⚙️ Configurable session duration per order type
- 📧 Email/notification khi session sắp hết hạn

**Session management framework đã sẵn sàng!** 🎯

