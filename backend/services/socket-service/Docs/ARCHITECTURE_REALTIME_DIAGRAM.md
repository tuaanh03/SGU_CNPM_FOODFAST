# Architecture Diagram - Real-time Order Flow

## System Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Customer  │     │  Restaurant │     │    Admin     │
│  (Frontend) │     │  (Frontend) │     │ (Dashboard)  │
└──────┬──────┘     └──────┬──────┘     └──────────────┘
       │                   │
       │ HTTP              │ Socket.IO
       │                   │
┌──────▼──────────────────▼───────────────────────────┐
│              API Gateway (Port 3000)                 │
└──────┬──────────────────┬───────────────────────────┘
       │                   │
       │ HTTP              │ Socket.IO
       │                   │
┌──────▼──────┐     ┌──────▼──────┐
│Order Service│     │Socket Service│◄─── NEW!
│  (Port 3001)│     │  (Port 3011) │
└──────┬──────┘     └──────┬───────┘
       │                   │
       │ Kafka             │ Kafka Subscribe
       │ Publish           │ - order.confirmed
       ▼                   │ - restaurant.order.status
┌─────────────────────────┼────────────────────┐
│         Apache Kafka    │                    │
│  ┌──────────────────────▼─────────────┐     │
│  │ Topics:                             │     │
│  │ - order.create                      │     │
│  │ - order.confirmed      ◄────────────┼─────┤
│  │ - payment.event                     │     │
│  │ - restaurant.order.status ◄─────────┼─────┤
│  └─────────────────────────────────────┘     │
└──────┬──────────────────┬──────────────┬─────┘
       │                  │              │
       │                  │              │
┌──────▼──────┐   ┌───────▼─────┐  ┌────▼────────┐
│  Payment    │   │ Restaurant  │  │Notification │
│  Service    │   │  Service    │  │  Service    │
│ (Port 3003) │   │ (Port 3005) │  │ (Port 3006) │
└─────────────┘   └──────┬──────┘  └─────────────┘
                         │
                         │ Publish
                         │ restaurant.order.status
                         └──────────────────────┐
                                                │
                                                ▼
                                          ┌──────────┐
                                          │  Kafka   │
                                          └──────────┘
```

## Order Flow Sequence Diagram

```
Customer    Order-Service    Payment-Service    Socket-Service    Restaurant-Service    Restaurant-Frontend
   │              │                  │                 │                   │                      │
   │─ Create Order ──►│              │                 │                   │                      │
   │              │                  │                 │                   │                      │
   │◄─ OrderID ───┤                  │                 │                   │                      │
   │ (pending)    │                  │                 │                   │                      │
   │              │                  │                 │                   │                      │
   │              │─ Kafka: order.create ─►            │                   │                      │
   │              │                  │                 │                   │                      │
   │              │                  │◄─ Process ──────┤                   │                      │
   │              │                  │                 │                   │                      │
   │              │◄─ payment.success ─                │                   │                      │
   │              │                  │                 │                   │                      │
   │              │─ Update: confirmed ──              │                   │                      │
   │              │                  │                 │                   │                      │
   │              │─ Kafka: order.confirmed ──────────►│                   │                      │
   │              │                  │                 │                   │                      │
   │              │                  │                 │◄─ Consume ────────┤                      │
   │              │                  │                 │                   │                      │
   │              │                  │                 │                   │─ RestaurantOrder ────►│
   │              │                  │                 │                   │   (CONFIRMED)        │
   │              │                  │                 │                   │                      │
   │              │                  │                 │─ Socket emit: order:confirmed ─────────►│
   │              │                  │                 │                   │                ⚡ NEW ORDER!
   │              │                  │                 │                   │                      │
   │              │                  │                 │                   │                      │
   │              │                  │                 │                   │◄─ [After 30s] ───────┤
   │              │                  │                 │                   │   Auto transition    │
   │              │                  │                 │                   │                      │
   │              │                  │                 │                   │─ Update: PREPARING ──┤
   │              │                  │                 │                   │                      │
   │              │                  │                 │◄─ Kafka: restaurant.order.status ────────┤
   │              │                  │                 │   (PREPARING)     │                      │
   │              │                  │                 │                   │                      │
   │              │◄─ Kafka: restaurant.order.status ──┤                   │                      │
   │              │                  │                 │                   │                      │
   │              │─ Update: preparing ─               │                   │                      │
   │              │                  │                 │                   │                      │
   │◄─ Socket: order:status:update ─────────────────────                   │                      │
   │  (PREPARING) │                  │                 │                   │                      │
   ⚡ Update UI!  │                  │                 │                   │                      │
```

## Status Transition Flow

```
┌──────────┐  Payment    ┌───────────┐  Restaurant  ┌────────────┐  Restaurant  ┌──────────────┐
│ PENDING  │  Success    │ CONFIRMED │  Auto (30s)  │ PREPARING  │    Ready     │READY_FOR_PICKUP│
│          ├────────────►│           ├─────────────►│            ├─────────────►│               │
│(Chờ TT)  │             │(Đã TT)    │              │(Đang làm)  │              │(Sẵn sàng)     │
└──────────┘             └───────────┘              └────────────┘              └───────┬────────┘
     │                                                                                   │
     │ Payment                                                                           │
     │ Failed/                                                                           │
     │ Expired                                                                           │
     │                                                                                   │ Shipper
     ▼                                                                                   │ Pick up
┌──────────┐                                                                            │
│CANCELLED │                                                                            ▼
│          │                                                         ┌──────────┐  ┌────────────┐
│ (Đã hủy) │                                                         │COMPLETED │◄─┤ DELIVERING │
└──────────┘                                                         │(Hoàn tất)│  │(Đang giao) │
                                                                     └──────────┘  └────────────┘
```

## Real-time Events Flow

```
╔════════════════════════════════════════════════════════════════════════╗
║                          REAL-TIME FLOW                                ║
╚════════════════════════════════════════════════════════════════════════╝

Order Service                    Socket Service              Restaurant Frontend
     │                                  │                            │
     │─────[1] Publish to Kafka ───────►│                            │
     │    Topic: order.confirmed        │                            │
     │    Payload: {orderId, items...}  │                            │
     │                                  │                            │
     │                                  │────[2] Consume & Process ──►│
     │                                  │                            │
     │                                  │─[3] Socket.IO Emit ────────►│
     │                                  │ Event: "order:confirmed"   │
     │                                  │ Room: "restaurant:{id}"    │
     │                                  │                            │
     │                                  │                       ⚡ [4] UI Update
     │                                  │                            │ New Order!
     │                                  │                            │ Play Sound
     │                                  │                            │ Show Notification


Restaurant Service              Socket Service              Customer Frontend
     │                                  │                            │
     │─────[1] Publish to Kafka ───────►│                            │
     │    Topic: restaurant.order.status│                            │
     │    Payload: {status: PREPARING}  │                            │
     │                                  │                            │
     │                                  │────[2] Consume & Process ──►│
     │                                  │                            │
     │                                  │─[3] Socket.IO Emit ────────►│
     │                                  │ Event: "order:status:update"│
     │                                  │ Room: "order:{orderId}"    │
     │                                  │                            │
     │                                  │                       ⚡ [4] UI Update
     │                                  │                            │ "Đang chuẩn bị"
     │                                  │                            │ Progress Bar


Order Service                    Socket Service              Customer Frontend
     │                                  │                            │
     │◄────[5] Consume from Kafka ──────┤                            │
     │    Topic: restaurant.order.status│                            │
     │                                  │                            │
     │─────[6] Update Database ─────────┤                            │
     │    status = "preparing"          │                            │
```

## Data Flow Summary

1. **Payment Success** → Order status: `pending` → `confirmed`
2. **Order Confirmed** → Kafka → Socket Service → Restaurant (real-time)
3. **Restaurant Processing** (30s auto) → Status: `PREPARING`
4. **Status Change** → Kafka → Socket Service → Customer (real-time) + Order Service (DB update)
5. **Continue...** → `READY` → `DELIVERING` → `COMPLETED`

## Key Features

✅ **Real-time**: No refresh needed  
✅ **Event-driven**: Kafka ensures reliability  
✅ **Scalable**: Socket.IO rooms for multi-tenant  
✅ **Monitored**: Prometheus metrics for all services  
✅ **Decoupled**: Services communicate via events  

