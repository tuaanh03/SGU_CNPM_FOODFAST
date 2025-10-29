# Nguyên tắc

- Quy tắc thực hiện: luôn tuân thủ đã đề ra trong mô tả này, **không thêm bớt gì khác**. Cấm cãi.
- Làm theo cấu trúc của các service mà tôi đã có.
- Tôi chỉ yêu cầu bạn gợi ý và giải thích, không viết code.
- Luôn phản hồi bằng tiếng Việt
---

## 1. Yêu cầu
- Giải thiích và gợi ý giúp tôi Restaurant service có nên tham gia vào topics kafka để cập nhật menu từ product service hay không.
- Nếu có, hãy liệt kê các topics và payload.
- Nếu không, hãy giải thích lý do.
- Ngoài ra, tôi đang có workflow  là restaurant menu sẽ create topic để order service subscribe và tạo một bảng lưu trữ menu tạm trong order service để tránh gọi trực tiếp product service. Mỗi khi có thay đổi từ menu, thì sẽ phát sự kiện để order service cập nhật lại bảng menu tạm này. Và khi order service truy xuất dữ liệu từ redis của cart service, nó sẽ lấy dữ liệu từ bảng menu tạm này để tránh gọi trực tiếp product service. Khi order service confirm, nó sẽ publish sự kiện đến restaurant menu để xác nhận. Restaurant menu sẽ accept hoặc decline. Nếu accept thì order service sẽ tiếp tục quy trình thanh toán. Nếu decline thì order service sẽ hủy đơn hàng và thông báo cho user. Và khi chu nhà hàng cập nhật trạng thái mở hoặc đóng cũng kiểm tra đến hoạt động của nhà hàng còn không ?



