1) Vai trò & ranh giới (bounded context)

Catalog (CRUD): sản phẩm, danh mục, giá, trạng thái hiển thị.

Inventory (stock): quản lý tồn kho, đặt giữ (reserve) khi đơn hàng tạo, xác nhận trừ (commit) khi thanh toán thành công, trả lại (release) nếu thanh toán thất bại/hủy.

Product Service không tính phí/thuế & không tạo đơn; chỉ cung cấp dữ liệu sản phẩm và đảm bảo tính nhất quán tồn kho theo sự kiện.


2) Sự kiện Kafka (topics & payload)

Topics

order.create (có sẵn) → Product reserve.

inventory.reserve.result (mới, do Product publish) → Order cập nhật trạng thái chờ thanh toán hoặc báo hết hàng.

payment.event (có sẵn) → Product commit hoặc release.


3) Luồng nghiệp vụ (Saga đơn giản)

Order Service publish order.create.

Product Service consume → kiểm tra tất cả items:

Nếu đủ tồn → ghi reservation (tạm giữ), giảm available (không trừ hẳn stock_on_hand), publish inventory.reserve.result: RESERVED.

Nếu thiếu → publish REJECTED.

Payment Service xử lý → publish payment.event.

Product Service consume:

PAID → commit: trừ hẳn kho, xóa reservation.

FAILED/CANCELED → release: trả lại số đã giữ.

Order Service đồng bộ trạng thái đơn qua payment.event (như bạn đang có).

Notification Service có thể bắn mail khi RESERVED và khi PAID.