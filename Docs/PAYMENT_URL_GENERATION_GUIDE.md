# Payment URL Generation - Implementation Guide

## 🎯 Nguyên Tắc Cốt Lõi

### ✅ ĐÚNG: On-Demand URL Generation
```
Payment Intent (DB) → Generate URL → Return to Frontend
         ↓                  ↓               ↓
    Persistent         Ephemeral      Use immediately
```

### ❌ SAI: Pre-Generated URL Storage
```
Payment Intent + URL (DB) → Return old URL → May be expired/invalid
```

---

## 🏗️ Architecture Overview

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ 1. POST /orders/{orderId}/retry-payment
       ↓
┌──────────────────┐
│  Order Service   │
│  (API Gateway)   │
└──────┬───────────┘
       │ 2. HTTP call hoặc Kafka event
       ↓
┌──────────────────────┐
│  Payment Service     │
│  - Check payment DB  │
│  - Generate fresh URL│
└──────┬───────────────┘
       │ 3. Return payment URL
       ↓
┌──────────────────┐
│  Frontend        │
│  Redirect to URL │
└──────────────────┘
```

---

## 📝 Implementation Steps

### **Step 1: Tạo Payment Schema (Payment Service)**

```prisma
// File: backend/services/payment-service/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum PaymentStatus {
  pending
  success
  failed
  expired
  canceled
}

enum PaymentProvider {
  VNPAY
  MOMO
  ZALOPAY
  COD
}

model Payment {
  id              String          @id @default(uuid())
  
  // Foreign keys (soft reference - no FK vì microservice)
  orderId         String
  userId          String
  
  // Payment Intent ID (CORE) - Dùng làm vnp_TxnRef
  paymentIntentId String          @unique
  
  // Payment details
  amount          Int             // VND
  currency        String          @default("VND")
  provider        PaymentProvider @default(VNPAY)
  description     String?
  
  // Status
  status          PaymentStatus   @default(pending)
  failureReason   String?
  
  // VNPay response (sau khi callback)
  vnpayTransactionNo String?      @unique
  vnpayBankCode      String?
  vnpayCardType      String?
  vnpayResponseCode  String?
  
  // Timestamps
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  expiresAt       DateTime        // Payment intent expiry (15 phút)
  paidAt          DateTime?
  
  // Retry tracking
  isRetry         Boolean         @default(false)
  retryCount      Int             @default(0)
  originalPaymentId String?       // Link to original payment if retry
  
  // Metadata
  metadata        Json?
  ipAddress       String?
  userAgent       String?
  
  @@index([orderId, status])
  @@index([userId, status])
  @@index([paymentIntentId])
  @@index([status, expiresAt]) // For cronjob
}
```

---

### **Step 2: Payment Service - Create/Retry Payment Logic**

```typescript
// File: backend/services/payment-service/src/services/payment.service.ts

import { PrismaClient, PaymentStatus } from '@prisma/client';
import { createVNPayUrl } from '../utils/vnpay';
import { publishEvent } from '../utils/kafka';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface CreatePaymentInput {
  orderId: string;
  userId: string;
  amount: number;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface PaymentResponse {
  success: boolean;
  payment?: {
    id: string;
    paymentIntentId: string;
    amount: number;
    status: PaymentStatus;
    expiresAt: Date;
  };
  paymentUrl?: string;
  error?: string;
}

export class PaymentService {
  /**
   * Tạo hoặc lấy payment cho order
   * Tự động handle retry logic
   */
  async createOrGetPayment(input: CreatePaymentInput): Promise<PaymentResponse> {
    const { orderId, userId, amount, description, ipAddress, userAgent } = input;
    
    try {
      // 1. Tìm payment hiện tại của order
      const existingPayment = await prisma.payment.findFirst({
        where: {
          orderId,
          userId,
          status: 'pending'
        },
        orderBy: { createdAt: 'desc' }
      });
      
      // 2. Kiểm tra payment còn valid không
      const now = new Date();
      
      if (existingPayment && existingPayment.expiresAt > now) {
        // Payment còn valid, generate URL mới từ payment này
        console.log(`Reusing existing payment: ${existingPayment.id}`);
        
        const paymentUrl = await this.generatePaymentUrl(existingPayment);
        
        return {
          success: true,
          payment: {
            id: existingPayment.id,
            paymentIntentId: existingPayment.paymentIntentId,
            amount: existingPayment.amount,
            status: existingPayment.status,
            expiresAt: existingPayment.expiresAt
          },
          paymentUrl
        };
      }
      
      // 3. Expire old pending payments
      if (existingPayment) {
        await prisma.payment.updateMany({
          where: {
            orderId,
            status: 'pending'
          },
          data: {
            status: 'expired'
          }
        });
      }
      
      // 4. Count retries
      const retryCount = await prisma.payment.count({
        where: { orderId }
      });
      
      const MAX_RETRIES = 5;
      if (retryCount >= MAX_RETRIES) {
        return {
          success: false,
          error: `Maximum retry attempts (${MAX_RETRIES}) exceeded. Please create a new order.`
        };
      }
      
      // 5. Tạo payment mới
      const paymentIntentId = this.generatePaymentIntentId(orderId);
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 phút
      
      const payment = await prisma.payment.create({
        data: {
          orderId,
          userId,
          paymentIntentId,
          amount,
          description: description || `Payment for order ${orderId}`,
          status: 'pending',
          expiresAt,
          isRetry: retryCount > 0,
          retryCount,
          originalPaymentId: existingPayment?.id,
          ipAddress,
          userAgent
        }
      });
      
      console.log(`Created new payment: ${payment.id} with intent: ${paymentIntentId}`);
      
      // 6. Generate payment URL
      const paymentUrl = await this.generatePaymentUrl(payment);
      
      // 7. Publish event (không bao gồm URL)
      await publishEvent(
        orderId,
        userId,
        '',
        amount,
        payment.description || '',
        'pending',
        paymentIntentId
      );
      
      return {
        success: true,
        payment: {
          id: payment.id,
          paymentIntentId: payment.paymentIntentId,
          amount: payment.amount,
          status: payment.status,
          expiresAt: payment.expiresAt
        },
        paymentUrl
      };
      
    } catch (error: any) {
      console.error('Error creating payment:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment'
      };
    }
  }
  
  /**
   * Generate payment URL từ payment record
   * Có thể gọi nhiều lần cho cùng 1 payment
   */
  private async generatePaymentUrl(payment: any): Promise<string> {
    const result = await createVNPayUrl({
      txnRef: payment.paymentIntentId,
      amount: payment.amount,
      orderInfo: payment.description || `Order ${payment.orderId}`,
      returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3001/vnpay_return',
      ipAddr: payment.ipAddress || '127.0.0.1'
    });
    
    if (!result.success || !result.paymentUrl) {
      throw new Error(result.error || 'Failed to generate VNPay URL');
    }
    
    return result.paymentUrl;
  }
  
  /**
   * Generate unique payment intent ID
   */
  private generatePaymentIntentId(orderId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    
    // Format: orderId-timestamp-random
    // Example: abc123-1737976410123-a1b2c3d4e5f6g7h8
    return `${orderId.substring(0, 8)}-${timestamp}-${random}`;
  }
  
  /**
   * Get payment by order ID (để frontend check status)
   */
  async getPaymentByOrderId(orderId: string, userId: string): Promise<any> {
    return prisma.payment.findFirst({
      where: {
        orderId,
        userId
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  /**
   * Get payment by payment intent ID (cho VNPay callback)
   */
  async getPaymentByIntentId(paymentIntentId: string): Promise<any> {
    return prisma.payment.findUnique({
      where: { paymentIntentId }
    });
  }
}

export const paymentService = new PaymentService();
```

---

### **Step 3: Payment Service - API Routes**

```typescript
// File: backend/services/payment-service/src/routes/payment.routes.ts

import { Router } from 'express';
import { paymentService } from '../services/payment.service';

export const paymentRouter = Router();

/**
 * Tạo hoặc lấy payment cho order
 * POST /api/payments/create
 */
paymentRouter.post('/create', async (req, res) => {
  try {
    const { orderId, userId, amount, description } = req.body;
    
    // Validate input
    if (!orderId || !userId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: orderId, userId, amount'
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }
    
    // Get IP and User-Agent
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    
    const result = await paymentService.createOrGetPayment({
      orderId,
      userId,
      amount,
      description,
      ipAddress,
      userAgent
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Payment URL generated successfully',
      data: {
        payment: result.payment,
        paymentUrl: result.paymentUrl
      }
    });
    
  } catch (error: any) {
    console.error('Error in /payments/create:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get payment status by order ID
 * GET /api/payments/order/:orderId
 */
paymentRouter.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }
    
    const payment = await paymentService.getPaymentByOrderId(
      orderId,
      userId as string
    );
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Không return paymentUrl, chỉ return payment info
    return res.status(200).json({
      success: true,
      data: {
        id: payment.id,
        paymentIntentId: payment.paymentIntentId,
        amount: payment.amount,
        status: payment.status,
        expiresAt: payment.expiresAt,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt
      }
    });
    
  } catch (error: any) {
    console.error('Error in /payments/order/:orderId:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
```

---

### **Step 4: Order Service - Retry Payment Endpoint**

```typescript
// File: backend/services/order-service/src/controllers/order.ts

/**
 * Retry payment for existing order
 * POST /orders/:orderId/retry-payment
 */
export const retryPayment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
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
    
    // 1. Validate order
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
        userId
      }
    });
    
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found"
      });
      return;
    }
    
    // 2. Check order status
    if (order.status === 'success') {
      res.status(400).json({
        success: false,
        message: "Order has already been paid"
      });
      return;
    }
    
    if (order.status === 'failed') {
      res.status(400).json({
        success: false,
        message: "Order payment failed. Please create a new order"
      });
      return;
    }
    
    // 3. Call Payment Service để tạo/lấy payment URL
    try {
      const paymentResponse = await fetch('http://payment-service:3001/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: order.id,
          userId: order.userId,
          amount: order.totalPrice,
          description: `Payment for order ${order.id}`
        })
      });
      
      const paymentData = await paymentResponse.json();
      
      if (!paymentData.success) {
        res.status(400).json({
          success: false,
          message: paymentData.message || 'Failed to create payment'
        });
        return;
      }
      
      // 4. Return payment URL cho frontend
      res.status(200).json({
        success: true,
        message: 'Payment URL generated successfully',
        data: {
          orderId: order.id,
          payment: paymentData.data.payment,
          paymentUrl: paymentData.data.paymentUrl
        }
      });
      
    } catch (error: any) {
      console.error('Error calling Payment Service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to communicate with Payment Service'
      });
    }
    
  } catch (error) {
    console.error('Error retrying payment:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
```

```typescript
// File: backend/services/order-service/src/routes/order.routes.ts

import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { 
  createOrder, 
  getOrderStatus, 
  getUserOrders, 
  createOrderFromCart,
  retryPayment  // ← Thêm import
} from "../controllers/order";

export const orderRoute: Router = Router();

orderRoute.post("/create", authMiddleware, createOrder);
orderRoute.post("/create-from-cart", authMiddleware, createOrderFromCart);
orderRoute.get("/status/:orderId", authMiddleware, getOrderStatus);
orderRoute.get("/list", authMiddleware, getUserOrders);

// ✅ NEW: Retry payment endpoint
orderRoute.post("/:orderId/retry-payment", authMiddleware, retryPayment);
```

---

### **Step 5: Update VNPay Utility để Support Custom Params**

```typescript
// File: backend/services/payment-service/src/utils/vnpay.ts

import env from "dotenv";
import * as crypto from "crypto";

env.config();

const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE as string;
const VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET as string;
const VNPAY_API_URL = process.env.VNPAY_API_URL as string;

interface CreateVNPayUrlParams {
  txnRef: string;      // paymentIntentId
  amount: number;      // VND
  orderInfo: string;
  returnUrl: string;
  ipAddr?: string;
}

/**
 * Tạo VNPay payment URL
 * CAN BE CALLED MULTIPLE TIMES với cùng txnRef
 */
export async function createVNPayUrl(params: CreateVNPayUrlParams) {
  try {
    const { txnRef, amount, orderInfo, returnUrl, ipAddr = '127.0.0.1' } = params;
    
    const createDate = new Date()
      .toISOString()
      .replace(/[-:TZ]/g, "")
      .slice(0, 14);

    const rawParams: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: VNPAY_TMN_CODE,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,  // ← PaymentIntentId
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: "other",
      vnp_Amount: Math.round(amount * 100).toString(),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    const sortedKeys = Object.keys(rawParams).sort();
    const params = new URLSearchParams();
    for (const key of sortedKeys) {
      params.append(key, rawParams[key]);
    }

    const signData = params.toString();
    const signed = crypto
      .createHmac("sha512", VNPAY_HASH_SECRET)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    params.append("vnp_SecureHash", signed);
    const paymentUrl = `${VNPAY_API_URL}?${params.toString()}`;

    return { 
      success: true, 
      paymentIntentId: txnRef, 
      paymentUrl 
    };
  } catch (error: any) {
    console.error(`Failed to create VNPay URL:`, error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Keep old function for backward compatibility
export async function processPayment(
  orderId: string,
  userId: string,
  amount: number,
  item: string
) {
  const txnRef = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return createVNPayUrl({
    txnRef,
    amount,
    orderInfo: `Order ${orderId} - ${item}`,
    returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3001/vnpay_return',
    ipAddr: '127.0.0.1'
  });
}
```

---

### **Step 6: Frontend Implementation**

```typescript
// File: frontend/src/pages/OrderDetails.tsx

import { useState } from 'react';
import { toast } from 'sonner';

interface OrderDetailsProps {
  orderId: string;
  orderStatus: 'pending' | 'success' | 'failed';
}

export const OrderDetails: React.FC<OrderDetailsProps> = ({ orderId, orderStatus }) => {
  const [loading, setLoading] = useState(false);
  
  const handleRetryPayment = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `http://localhost:3000/api/orders/${orderId}/retry-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success && data.data?.paymentUrl) {
        // Redirect to VNPay immediately
        toast.success('Redirecting to payment gateway...');
        
        // Small delay for UX
        setTimeout(() => {
          window.location.href = data.data.paymentUrl;
        }, 500);
      } else {
        toast.error(data.message || 'Failed to create payment');
      }
      
    } catch (error) {
      console.error('Error retrying payment:', error);
      toast.error('Failed to retry payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="order-details">
      {/* Order info */}
      
      {/* Payment action */}
      {orderStatus === 'pending' && (
        <div className="payment-section">
          <button
            onClick={handleRetryPayment}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Generating payment link...' : 'Pay Again'}
          </button>
          
          <p className="text-sm text-gray-500">
            Click to generate a new payment link
          </p>
        </div>
      )}
    </div>
  );
};
```

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    RETRY PAYMENT FLOW                            │
└─────────────────────────────────────────────────────────────────┘

1. User clicks "Pay Again" on Order Details page
   ↓
2. Frontend: POST /orders/{orderId}/retry-payment
   ↓
3. Order Service:
   - Validate order (pending, belongs to user)
   - Call Payment Service HTTP API
   ↓
4. Payment Service:
   - Check existing payment in DB
   - If valid & not expired → Reuse paymentIntentId
   - If expired or not exist → Create new payment record
   - Generate fresh VNPay URL (with paymentIntentId)
   - Return URL (NOT stored in DB)
   ↓
5. Order Service → Return URL to Frontend
   ↓
6. Frontend → Redirect user to VNPay URL
   ↓
7. User pays on VNPay
   ↓
8. VNPay → Callback to /vnpay_return?vnp_TxnRef={paymentIntentId}
   ↓
9. Payment Service:
   - Lookup payment by paymentIntentId
   - Verify signature
   - Check idempotency (status must be pending)
   - Update payment status → success/failed
   - Publish Kafka event
   ↓
10. Order Service (Kafka consumer):
    - Update order status
    ↓
11. Frontend: Show payment result
```

---

## ✅ Benefits của Approach Này

1. **Security**: Không lưu URL chứa signature
2. **Fresh Session**: Mỗi lần user click đều có URL mới với session mới
3. **Amount Sync**: Amount luôn lấy từ DB, không bị stale
4. **Idempotent**: PaymentIntentId unique, dùng để prevent duplicate
5. **Flexible**: Có thể thay đổi returnUrl, amount không ảnh hưởng payment record
6. **Scalable**: Payment Service có thể scale độc lập
7. **Audit Trail**: Có đầy đủ payment history trong DB

---

## 🔒 Security Checklist

- [ ] Verify VNPay signature trong callback
- [ ] Check payment status (idempotency)
- [ ] Validate amount match
- [ ] Check payment not expired
- [ ] Rate limiting cho retry attempts
- [ ] Log all payment events
- [ ] Encrypt sensitive data in DB
- [ ] Use HTTPS cho tất cả API calls

---

## 🧪 Testing Scenarios

1. **Happy Path**:
   - User retry payment → Get URL → Pay → Success

2. **Multiple Retries**:
   - User retry 3 times → Should reuse same paymentIntentId if not expired

3. **Expired Payment**:
   - Payment created 20 min ago → Retry → New payment created

4. **Max Retries**:
   - User retry 5 times → 6th attempt rejected

5. **Duplicate Callback**:
   - VNPay callback 2 times → Only first one processed

6. **Amount Mismatch**:
   - Order updated after payment created → New amount used

7. **Concurrent Requests**:
   - User clicks "Pay Again" 2 times quickly → Same payment returned

---

## 📝 Environment Variables

```bash
# Payment Service
VNPAY_TMN_CODE=YOUR_TMN_CODE
VNPAY_HASH_SECRET=YOUR_HASH_SECRET
VNPAY_API_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3001/vnpay_return
DATABASE_URL=postgresql://user:pass@localhost:5432/payment_db
```

---

## 🎯 Next Steps

1. Implement Payment Service database schema
2. Create Payment Service API endpoints
3. Update Order Service retry endpoint
4. Add frontend "Pay Again" button
5. Test thoroughly
6. Add monitoring & alerting
7. Document API for team

---

**Conclusion**: Không lưu payment URL là best practice. Chỉ lưu paymentIntentId và generate URL on-demand mỗi khi cần.

