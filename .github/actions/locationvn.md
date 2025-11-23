Mục tiêu

Thêm workflow "Order → Ready for pickup → Notify drone-service → Create Delivery → Push lên Dispatch UI" mà KHÔNG thay đổi cấu trúc project hiện tại.

Tóm tắt ý tưởng (ngắn):

Khi merchant báo "Ready" cho một RestaurantOrder, gọi endpoint backend (restaurant-service)
Backend cập nhật trường restaurantStatus -> READY_FOR_PICKUP và readyAt
Backend publish một event Kafka (topic có sẵn restaurant.order.status) với eventType = ORDER_READY_FOR_PICKUP (payload chuẩn)
drone-service (mới/đã cập nhật) có một Kafka consumer, lắng nghe topic restaurant.order.status và xử lý event ORDER_READY_FOR_PICKUP để tạo/ghi delivery record (idempotent)
socket-service đã subscribe restaurant.order.status — mở rộng handler để khi nhận ORDER_READY_FOR_PICKUP sẽ emit đến room dispatch (ví dụ dispatch) và/hoặc restaurant:{storeId} để UI merchant & admin thấy
admin-dashboard (DispatchQueuePage) subscribe websocket room dispatch và hiển thị delivery mới realtime
Yêu cầu và nguyên tắc

Không phá vỡ cấu trúc code hiện có
Dùng topic restaurant.order.status (đã có ở repo) để tận dụng consumer hiện tại
Idempotency: xử lý event nhiều lần không tạo duplicate delivery (upsert by orderId)
Bảo mật: endpoint merchant gọi phải authenticate (reuse middleware hiện có)
Hướng dẫn các file cần sửa, snippet kèm nơi chèn (không tự động sửa)
Checklist (những bước cần làm)

Backend - restaurant-service
Thêm helper controller transitionToReady(restaurantOrderId: string)
Thêm API endpoint (protected) để merchant trigger READY_FOR_PICKUP (ví dụ: PUT /stores/orders/:restaurantOrderId/ready)
Khi update DB -> publish Kafka event via existing publishRestaurantOrderStatusEvent với payload chuẩn
Backend - drone-service
Thêm Kafka consumer (groupId e.g. drone-service-group) subscribe restaurant.order.status
Khi nhận event ORDER_READY_FOR_PICKUP → upsert Delivery in DB (use prisma.upsert by orderId)
(Optional) Publish internal event delivery.created (topic) if needed
Backend - socket-service
Mở rộng handler handleRestaurantOrderStatus để detect ORDER_READY_FOR_PICKUP và emit dispatch:delivery:created to dispatch room
Ensure the payload to socket contains delivery summary (orderId, storeId, restaurantName, restaurantLat/Lng, customer info, etc.)
Frontend - restaurant-merchant
Thêm nút "Thông báo đội giao" trên MerchantOrdersPage.tsx khi status === 'preparing' (UI: small button)
Khi click, call new API PUT /api/stores/orders/:id/ready (via restaurantOrder.service) and show feedback
Frontend - admin-dashboard (DispatchQueuePage)
Subscribe socket room dispatch (use existing useSocket helper) và lắng nghe dispatch:delivery:created
Khi nhận event, thêm vào state queue để hiển thị realtime