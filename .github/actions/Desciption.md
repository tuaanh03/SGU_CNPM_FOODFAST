# Nguyên tắc

- Lưu ý: chưa dùng đến **Admin page** hay **Admin service** để quản lý sản phẩm, danh mục. Mình sẽ thêm sau.
- Quy tắc thực hiện: luôn tuân thủ đã đề ra trong mô tả này, **không thêm bớt gì khác**. Cấm cãi.
- Làm theo cấu trúc của các service mà tôi đã có.
- Luôn phản hồi bằng tiếng Việt
---

## 1. Vai trò & ranh giới (Bounded Context)

- **Catalog (CRUD):** sản phẩm, danh mục, giá, trạng thái hiển thị.
- **Inventory (stock):** quản lý tồn kho, đặt giữ (reserve) khi đơn hàng tạo, xác nhận trừ (commit) khi thanh toán thành công, trả lại (release) nếu thanh toán thất bại/hủy.
- **Product Service** không tính phí/thuế & không tạo đơn; chỉ cung cấp dữ liệu sản phẩm và đảm bảo tính nhất quán tồn kho theo sự kiện.

---

## 2. Sự kiện Kafka (Topics & Payload)

### Topics
- `order.create` (có sẵn) → Product reserve.
- `inventory.reserve.result` (mới, do Product publish) → Order cập nhật trạng thái chờ thanh toán hoặc báo hết hàng.
- `payment.event` (có sẵn) → Product commit hoặc release.

---

## 3. Luồng nghiệp vụ (Saga đơn giản)

1. **Order Service** publish `order.create`.
2. **Product Service** consume → kiểm tra tất cả items:
    - Nếu đủ tồn → ghi reservation (tạm giữ), giảm available (không trừ hẳn `stock_on_hand`), publish `inventory.reserve.result: RESERVED`.
    - Nếu thiếu → publish `REJECTED`.
3. **Payment Service** xử lý → publish `payment.event`.
4. **Product Service** consume:
    - `PAID` → commit: trừ hẳn kho, xóa reservation.
    - `FAILED` / `CANCELED` → release: trả lại số đã giữ.
5. **Order Service** đồng bộ trạng thái đơn qua `payment.event` (như bạn đang có).
6. **Notification Service** có thể bắn mail khi `RESERVED` và khi `PAID`.

---

## 4. Mô hình dữ liệu (PostgreSQL / Prisma)

```prisma
model Product {
  id          String   @id @default(uuid())
  sku         String   @unique
  name        String
  price       Int
  isActive    Boolean  @default(true)

  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id])

  stockOnHand Int      @default(0)
  reserved    Int      @default(0)
}

model Category {
  id   String @id @default(uuid())
  name String @unique
}

model Reservation {
  id      String @id @default(uuid())
  orderId String @unique
  items   Json
  status  String
}
```
