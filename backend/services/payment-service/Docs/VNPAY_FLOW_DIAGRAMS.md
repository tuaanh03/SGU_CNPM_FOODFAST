# VNPay Payment Flow với Ngrok

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VNPay Server                                 │
│                                                                     │
│  User hoàn thành thanh toán                                         │
│  ├─── Return URL (redirect browser)                                │
│  └─── IPN URL (server-to-server callback)                          │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ https://abc123.ngrok.io/vnpay_return
                      │ https://abc123.ngrok.io/vnpay_ipn
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Ngrok Tunnel (Public)                           │
│                                                                     │
│  https://abc123.ngrok.io → http://localhost:3000                   │
│                                                                     │
│  Web Interface: http://127.0.0.1:4040                              │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ http://localhost:3000
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Gateway (Port 3000)                         │
│                                                                     │
│  Routes:                                                            │
│  ├─── /vnpay_return  → Payment Service                            │
│  ├─── /vnpay_ipn     → Payment Service                            │
│  └─── /api/*         → Various Services                            │
│                                                                     │
│  Middleware: CORS, Proxy, Auth (cho /api/*)                        │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ http://localhost:3003
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Payment Service (Port 3003)                        │
│                                                                     │
│  Endpoints:                                                         │
│  ├─── GET /vnpay_return                                            │
│  │    ├─── Verify signature (optional)                            │
│  │    ├─── Publish event to Kafka                                 │
│  │    └─── Redirect to frontend                                   │
│  │                                                                 │
│  └─── GET /vnpay_ipn                                               │
│       ├─── Verify signature (required)                             │
│       ├─── Publish event to Kafka                                  │
│       └─── Return JSON response                                    │
│           { RspCode: "00", Message: "success" }                    │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Publish event: payment.result
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Kafka (Port 9092)                             │
│                                                                     │
│  Topic: payment.result                                              │
│  Message: {                                                         │
│    orderId: "abc-123",                                              │
│    status: "success",                                               │
│    paymentIntentId: "1234567890",                                   │
│    amount: 100000                                                   │
│  }                                                                  │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Consume event
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Order Service (Port 3002)                         │
│                                                                     │
│  ├─── Listen to Kafka topic: payment.result                        │
│  ├─── Update order status:                                         │
│  │    pending → paid (if success)                                 │
│  │    pending → failed (if failed)                                │
│  └─── Save payment transaction info                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Sequence Diagram - VNPay Return URL Flow

```
User        VNPay       Ngrok       Gateway     Payment     Frontend
 │            │           │            │          Service       │
 │ (1) Pay    │           │            │            │           │
 ├───────────>│           │            │            │           │
 │            │           │            │            │           │
 │ (2) Return │           │            │            │           │
 │<───────────┤           │            │            │           │
 │            │           │            │            │           │
 │      Browser redirect  │            │            │           │
 │      to return URL     │            │            │           │
 ├───────────────────────>│            │            │           │
 │                        │  Forward   │            │           │
 │                        ├───────────>│            │           │
 │                        │            │  Proxy     │           │
 │                        │            ├───────────>│           │
 │                        │            │            │           │
 │                        │            │   (3) Process          │
 │                        │            │   - Verify signature   │
 │                        │            │   - Publish to Kafka   │
 │                        │            │            │           │
 │                        │            │ (4) Redirect           │
 │                        │            │<───────────┤           │
 │                        │  302       │            │           │
 │                        │<───────────┤            │           │
 │  (5) Redirect to       │            │            │           │
 │      payment result    │            │            │           │
 ├────────────────────────────────────────────────────────────>│
 │                        │            │            │           │
 │  (6) Display result    │            │            │           │
 │<──────────────────────────────────────────────────────────────┤
```

## Sequence Diagram - VNPay IPN Flow

```
VNPay       Ngrok       Gateway     Payment     Kafka       Order
Server                              Service                 Service
  │           │            │          │           │           │
  │ (1) IPN   │            │          │           │           │
  │  Callback │            │          │           │           │
  ├──────────>│            │          │           │           │
  │           │  Forward   │          │           │           │
  │           ├───────────>│          │           │           │
  │           │            │  Proxy   │           │           │
  │           │            ├─────────>│           │           │
  │           │            │          │           │           │
  │           │            │  (2) Verify          │           │
  │           │            │      signature       │           │
  │           │            │          │           │           │
  │           │            │  (3) Publish         │           │
  │           │            │      event           │           │
  │           │            │          ├──────────>│           │
  │           │            │          │           │           │
  │           │            │          │        (4) Consume    │
  │           │            │          │           ├──────────>│
  │           │            │          │           │           │
  │           │            │          │           │   (5) Update
  │           │            │          │           │       order
  │           │            │          │           │       status
  │           │            │          │           │           │
  │           │            │  (6) Response        │           │
  │           │            │      {"RspCode":"00"}│           │
  │           │            │<─────────┤           │           │
  │           │  200 OK    │          │           │           │
  │           │<───────────┤          │           │           │
  │  200 OK   │            │          │           │           │
  │<──────────┤            │          │           │           │
```

## Signature Verification Process

```
┌────────────────────────────────────────────────────────────────┐
│  VNPay sends callback with params:                             │
│                                                                 │
│  vnp_Amount=10000000                                           │
│  vnp_BankCode=NCB                                              │
│  vnp_OrderInfo=Order abc-123                                   │
│  vnp_ResponseCode=00                                           │
│  vnp_TxnRef=1234567890                                         │
│  vnp_SecureHash=abc123def456...                                │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 1: Extract vnp_SecureHash                                │
│                                                                 │
│  receivedHash = "abc123def456..."                              │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 2: Remove hash fields                                    │
│                                                                 │
│  params = {                                                    │
│    vnp_Amount: "10000000",                                     │
│    vnp_BankCode: "NCB",                                        │
│    vnp_OrderInfo: "Order abc-123",                            │
│    vnp_ResponseCode: "00",                                     │
│    vnp_TxnRef: "1234567890"                                    │
│  }                                                             │
│  // vnp_SecureHash removed                                     │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 3: Sort keys alphabetically                              │
│                                                                 │
│  sortedKeys = [                                                │
│    "vnp_Amount",                                               │
│    "vnp_BankCode",                                             │
│    "vnp_OrderInfo",                                            │
│    "vnp_ResponseCode",                                         │
│    "vnp_TxnRef"                                                │
│  ]                                                             │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 4: Build sign data string                                │
│                                                                 │
│  signData =                                                    │
│    "vnp_Amount=10000000&" +                                    │
│    "vnp_BankCode=NCB&" +                                       │
│    "vnp_OrderInfo=Order abc-123&" +                           │
│    "vnp_ResponseCode=00&" +                                    │
│    "vnp_TxnRef=1234567890"                                     │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 5: Calculate HMAC SHA512                                 │
│                                                                 │
│  calculatedHash = HMAC_SHA512(                                 │
│    signData,                                                   │
│    VNPAY_HASH_SECRET                                           │
│  )                                                             │
│                                                                 │
│  calculatedHash = "abc123def456..."                            │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 6: Compare hashes                                        │
│                                                                 │
│  if (calculatedHash === receivedHash) {                        │
│    ✅ Valid - Request from VNPay                              │
│    Process payment result                                      │
│  } else {                                                      │
│    ❌ Invalid - Possible fraud                                │
│    Return error response                                       │
│  }                                                             │
└────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌────────────────────────────────────────────────────────────────┐
│  VNPay IPN Callback                                            │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
              ┌─────────────┐
              │  Verify     │
              │  Signature  │
              └──────┬──────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼ Valid                   ▼ Invalid
┌───────────────┐          ┌──────────────────┐
│ Process       │          │ Return error:    │
│ Payment       │          │ {                │
└───────┬───────┘          │   RspCode: "97", │
        │                  │   Message:       │
        │                  │     "Invalid     │
        │                  │      signature"  │
        │                  │ }                │
        │                  └──────────────────┘
        │
        ▼
┌───────────────────┐
│ Publish to Kafka  │
└────────┬──────────┘
         │
    ┌────┴────┐
    │         │
    ▼ Success ▼ Failed
┌─────────┐ ┌──────────────────┐
│ Return: │ │ Return error:    │
│ {       │ │ {                │
│  RspCode│ │   RspCode: "99", │
│   : "00"│ │   Message:       │
│  Message│ │     "Unknown     │
│   : "   │ │      error"      │
│   success│ │ }                │
│ }       │ └──────────────────┘
└─────────┘
```

## Local Development Setup

```
Terminal 1          Terminal 2            Terminal 3           Terminal 4
────────────       ────────────          ────────────         ────────────
                                                              
$ cd api-gateway   $ cd payment-service  $ docker-compose    $ ./start-ngrok.sh
$ pnpm dev         $ pnpm dev            $ up                
                                                              
PORT: 3000         PORT: 3003            Kafka: 9092         Tunnel:
                                         PostgreSQL: 5432     abc123.ngrok.io
                                         Redis: 6379          → localhost:3000
```

## Production Setup (Future)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ https://yourdomain.com
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Nginx (Port 80/443)                          │
│                                                                 │
│  SSL Termination (Let's Encrypt)                                │
│  Rate Limiting                                                  │
│  Load Balancing                                                 │
│                                                                 │
│  location /vnpay_return {                                       │
│    proxy_pass http://api-gateway:3000;                          │
│  }                                                              │
│                                                                 │
│  location /vnpay_ipn {                                          │
│    proxy_pass http://api-gateway:3000;                          │
│  }                                                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
              Docker Network
              ────────────────
              API Gateway
              Payment Service
              Order Service
              Kafka
              PostgreSQL
```

