# ✅ SCRIPT VERIFY KAFKA TOPICS

## 🎯 MỤC ĐÍCH

Kiểm tra xem đã tạo đủ 7 topics trên Confluent Cloud chưa, và config có đúng không.

---

## 📋 MANUAL CHECKLIST

### **Truy cập Confluent Cloud:**

1. Login: https://confluent.cloud/
2. Chọn Environment → Cluster → Topics

### **Kiểm tra danh sách Topics:**

```
☐ order.create
   ├─ Partitions: 3
   ├─ Retention: 7 days (604800000 ms)
   └─ Status: Active

☐ order.expired
   ├─ Partitions: 3
   ├─ Retention: 7 days
   └─ Status: Active

☐ order.retry.payment
   ├─ Partitions: 3
   ├─ Retention: 7 days
   └─ Status: Active

☐ order.confirmed ⚠️ QUAN TRỌNG (Restaurant Service cần topic này)
   ├─ Partitions: 3
   ├─ Retention: 7 days
   └─ Status: Active

☐ payment.event
   ├─ Partitions: 3
   ├─ Retention: 7 days
   └─ Status: Active

☐ product.sync
   ├─ Partitions: 3
   ├─ Retention: 7 days
   └─ Status: Active

☐ inventory.reserve.result
   ├─ Partitions: 3
   ├─ Retention: 7 days
   └─ Status: Active
```

---

## 🔧 VERIFY BẰNG CONFLUENT CLI (Optional)

### **Cài đặt Confluent CLI:**

```bash
# macOS
brew install confluentinc/tap/cli

# Hoặc download từ:
# https://docs.confluent.io/confluent-cli/current/install.html
```

### **Login:**

```bash
confluent login --save
```

### **List Topics:**

```bash
# Set environment và cluster
confluent environment list
confluent environment use <env-id>

confluent kafka cluster list
confluent kafka cluster use <cluster-id>

# List tất cả topics
confluent kafka topic list

# Kiểm tra config của topic cụ thể
confluent kafka topic describe order.confirmed
```

**Output mong muốn:**

```
Topic: order.confirmed
Partitions: 3
Replication Factor: 3
Retention: 604800000 ms (7 days)
```

---

## 🧪 TEST MESSAGE FLOW

### **Test 1: Produce message vào order.confirmed**

Từ Confluent Cloud UI:

1. Topics → **order.confirmed** → Messages → Produce

```json
{
  "eventType": "ORDER_CONFIRMED",
  "orderId": "test-order-001",
  "storeId": "test-store-001",
  "userId": "test-user-001",
  "items": [
    {
      "productId": "prod-001",
      "name": "Phở bò",
      "quantity": 2,
      "price": 50000
    }
  ],
  "totalPrice": 100000,
  "confirmedAt": "2025-11-19T10:00:00Z",
  "deliveryAddress": "123 Test Street",
  "contactPhone": "0901234567",
  "note": "Không hành",
  "estimatedPrepTime": 30
}
```

### **Test 2: Consume từ Restaurant Service**

Kiểm tra log Railway của restaurant-service:

```
✅ Log thành công:
Restaurant service received message on order.confirmed ORDER_CONFIRMED
RestaurantOrder upserted for store test-store-001, order test-order-001
⏰ Auto transitioning order test-order-001 to PREPARING in 30s
```

❌ **Nếu thấy lỗi:**
```
[Connection] Response Fetch(key: 1, version: 11) 
error: "This server is not the leader for that topic-partition"
```
→ Topic chưa được tạo hoặc config sai!

---

## 📊 VERIFY CONSUMER GROUPS

### **Từ Confluent Cloud UI:**

1. Vào **Consumers** (menu bên trái)
2. Tìm consumer groups:

```
☐ restaurant-service-group
   ├─ Topics: order.confirmed
   ├─ Members: 1+ (có instance running)
   ├─ Lag: 0 (hoặc nhỏ < 100)
   └─ Status: Active

☐ order-service-group
   ├─ Topics: payment.event, product.sync, inventory.reserve.result
   ├─ Members: 1+
   ├─ Lag: 0
   └─ Status: Active

☐ payment-service-group
   ├─ Topics: order.create, order.expired, order.retry.payment
   ├─ Members: 1+
   ├─ Lag: 0
   └─ Status: Active

☐ product-service-group
   ├─ Topics: order.create
   ├─ Members: 1+
   ├─ Lag: 0
   └─ Status: Active

☐ notification-service-group
   ├─ Topics: payment.event
   ├─ Members: 1+
   ├─ Lag: 0
   └─ Status: Active
```

**Lag = 0** nghĩa là consumer đã xử lý hết message → Good! ✅

**Lag > 100** nghĩa là consumer chậm hơn producer → Cần scale! ⚠️

---

## 🔍 VERIFY MESSAGE COUNT

### **Từ Confluent Cloud UI:**

Topics → Chọn topic → **Metrics**

Kiểm tra:

```
☐ Bytes In Rate: > 0 (có message đang gửi vào)
☐ Bytes Out Rate: > 0 (có consumer đang đọc)
☐ Messages: Tăng dần theo thời gian
```

---

## 🚨 TROUBLESHOOTING

### **Lỗi 1: Topic không xuất hiện trong list**

**Nguyên nhân:** Chưa tạo topic

**Giải pháp:**
1. Vào Topics → Add topic
2. Nhập tên chính xác (case-sensitive)
3. Set config: 3 partitions, 7 days retention

---

### **Lỗi 2: Consumer group không Active**

**Nguyên nhân:** Service chưa chạy hoặc crash

**Giải pháp:**
1. Kiểm tra log Railway của service
2. Verify biến môi trường KAFKA_* đã set đúng
3. Restart service

---

### **Lỗi 3: Lag tăng cao liên tục**

**Nguyên nhân:** Consumer xử lý chậm hơn producer

**Giải pháp:**
1. Scale thêm instance (Railway: increase replicas)
2. Tăng partitions (nhưng không thể giảm)
3. Optimize code xử lý message

---

### **Lỗi 4: "not the leader for that topic-partition"**

**Nguyên nhân:** 
- Topic chưa tạo
- Kafka cluster đang rebalancing
- Metadata chưa sync

**Giải pháp:**
1. Tạo topic nếu chưa có
2. Đợi 1-2 phút cho Kafka rebalance
3. Restart service

---

## ✅ VERIFICATION COMPLETED CHECKLIST

```
☐ Tạo đủ 7 topics trên Confluent Cloud
☐ Tất cả topics có status = Active
☐ Config: 3 partitions, 7 days retention
☐ Restart tất cả services trên Railway
☐ Log không còn lỗi "not the leader"
☐ Consumer groups status = Active
☐ Lag = 0 hoặc nhỏ
☐ Test message flow thành công
☐ Verify metrics: Bytes In/Out > 0
```

---

## 📝 NOTES

- **Topic names phải viết chính xác** (case-sensitive)
- **Partitions không thể giảm**, chỉ tăng được
- **Retention time** mặc định 7 days, có thể tăng lên 30 days nếu cần
- **Free tier $400 credit** đủ dùng 4 tháng
- **Replication factor = 3** (default Confluent Cloud, không cần đổi)

---

🎉 **Sau khi verify xong, Restaurant Service sẽ hoạt động bình thường!**

