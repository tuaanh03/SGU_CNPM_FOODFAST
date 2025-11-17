===========================================
K6 LOAD TEST - CUSTOMER WORKFLOW
===========================================

MÔ TẢ:
File k6-customer-flow.js mô phỏng hành vi của khách hàng thực tế khi sử dụng hệ thống:

WORKFLOW:
1. Đăng ký tài khoản mới (POST /api/auth/customer/register)
2. Đăng nhập (POST /api/auth/customer/login)
3. Verify token (POST /api/auth/verify-token)
4. Xem thông tin profile (GET /api/auth/profile)
5. Duyệt danh sách cửa hàng (GET /api/restaurants)
6. Xem chi tiết 2-3 cửa hàng ngẫu nhiên (GET /api/restaurants/:id)
7. Cập nhật profile (PUT /api/auth/profile) - 30% khách hàng
8. Đăng xuất (POST /api/auth/logout) - 50% khách hàng

===========================================
CÀI ĐẶT K6
===========================================

MacOS:
brew install k6

Linux:
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

Windows (Chocolatey):
choco install k6

===========================================
CÁCH CHẠY TEST
===========================================

1. CHẠY VỚI CẤU HÌNH MẶC ĐỊNH:
   cd /path/to/user-service/simulate/load-test
   k6 run k6-customer-flow.js

2. CHẠY VỚI BASE_URL TÙY CHỈNH:
   k6 run -e K6_BASE_URL=http://localhost:3001 k6-customer-flow.js

3. CHẠY VỚI API GATEWAY:
   k6 run -e K6_BASE_URL=http://localhost:3000 k6-customer-flow.js

4. CHẠY TEST NHANH (Smoke Test - 10 users trong 1 phút):
   k6 run --vus 10 --duration 1m k6-customer-flow.js

5. CHẠY TEST VỪA PHẢI (100 users trong 5 phút):
   k6 run --vus 100 --duration 5m k6-customer-flow.js

6. XUẤT KẾT QUẢ RA FILE JSON:
   k6 run --out json=results.json k6-customer-flow.js

7. XUẤT KẾT QUẢ RA INFLUXDB (nếu có):
   k6 run --out influxdb=http://localhost:8086/k6 k6-customer-flow.js

===========================================
CẤU HÌNH TEST
===========================================

Load Profile (mặc định):
- Warm up: 10 users trong 30s
- Ramp up: 50 users trong 1 phút
- Normal load: 100 users trong 2 phút
- Peak load: 200 users trong 3 phút
- Scale down: 100 users trong 2 phút
- Cool down: 0 users trong 1 phút
Tổng thời gian: ~9.5 phút

Thresholds (ngưỡng chất lượng):
- 95% requests < 3 giây
- 99% requests < 5 giây
- Tỷ lệ lỗi < 5%
- Đăng ký thành công > 90%
- Đăng nhập thành công > 95%
- Verify token thành công > 95%
- Lấy profile thành công > 95%
- Browse stores thành công > 95%

===========================================
METRICS THU THẬP
===========================================

Custom Metrics:
- register_duration_ms: Thời gian đăng ký (ms)
- login_duration_ms: Thời gian đăng nhập (ms)
- verify_token_duration_ms: Thời gian verify token (ms)
- profile_duration_ms: Thời gian lấy profile (ms)
- update_profile_duration_ms: Thời gian cập nhật profile (ms)
- browse_stores_duration_ms: Thời gian browse stores (ms)
- store_detail_duration_ms: Thời gian xem chi tiết store (ms)
- logout_duration_ms: Thời gian logout (ms)

Success Rates:
- register_success: Tỷ lệ đăng ký thành công
- login_success: Tỷ lệ đăng nhập thành công
- verify_token_success: Tỷ lệ verify token thành công
- profile_success: Tỷ lệ lấy profile thành công
- browse_stores_success: Tỷ lệ browse stores thành công
- logout_success: Tỷ lệ logout thành công

Total Requests:
- total_requests: Tổng số request đã gửi

===========================================
ĐỌC KẾT QUẢ
===========================================

Sau khi chạy xong, k6 sẽ hiển thị báo cáo:

     ✓ register status 200 or 201
     ✓ login status 200
     ✓ verify token status 200

     █ Customer Journey
       █ 1. Register New Customer
       █ 2. Login Customer
       █ 3. Verify Token
       ...

     checks.........................: 95.00% ✓ 950   ✗ 50
     data_received..................: 1.2 MB 2.0 kB/s
     data_sent......................: 800 kB 1.3 kB/s
     http_req_duration..............: avg=500ms min=100ms med=450ms max=2s p(95)=1.2s p(99)=1.8s
     http_reqs......................: 1000   1.6/s
     register_duration_ms...........: avg=200ms min=50ms med=180ms max=800ms
     login_duration_ms..............: avg=150ms min=40ms med=120ms max=600ms
     ...

CHÚ Ý:
- ✓ = Check passed
- ✗ = Check failed
- p(95) = 95 percentile
- p(99) = 99 percentile

===========================================
MÔ PHỎNG HÀNH VI NGƯỜI DÙNG THẬT
===========================================

1. Think Time (Thời gian suy nghĩ):
   - Sau khi đăng ký: 1-3 giây
   - Sau khi đăng nhập: 0.5-2 giây
   - Sau khi verify: 0.2-1 giây
   - Đọc profile: 1-3 giây
   - Duyệt stores: 2-5 giây
   - Xem chi tiết store: 3-8 giây
   - Giữa các iteration: 2-5 giây

2. Hành vi ngẫu nhiên:
   - Mỗi user có email và tên unique
   - Xem 2-3 cửa hàng ngẫu nhiên
   - 30% users cập nhật profile
   - 50% users logout sau khi xong

3. Email format:
   customer{VU}_{timestamp}_{random}@loadtest.com
   VD: customer1_1700123456789_1234@loadtest.com

===========================================
TROUBLESHOOTING
===========================================

Lỗi: "ECONNREFUSED"
→ Kiểm tra server có đang chạy không
→ Kiểm tra BASE_URL có đúng không

Lỗi: "register status 200 or 201" failed
→ Kiểm tra API đăng ký có hoạt động không
→ Có thể database đầy hoặc email đã tồn tại

Lỗi: "login has token" failed
→ Kiểm tra response của API login
→ Có thể format response khác với expected

Threshold failed (p95 > 3000ms)
→ Server quá tải, cần scale up
→ Database query chậm, cần optimize
→ Có bottleneck trong code

===========================================
VÍ DỤ EXPECTED RESULTS
===========================================

Với 1000 requests (ước tính):
- ~100 register requests
- ~100 login requests
- ~100 verify token requests
- ~100 profile requests
- ~100 browse stores requests
- ~200-300 store detail requests (2-3 stores per user)
- ~30 update profile requests (30% users)
- ~50 logout requests (50% users)

Total: ~880-980 requests (gần 1000)

===========================================
CONTACT & SUPPORT
===========================================

Nếu có vấn đề, kiểm tra:
1. Docker containers đang chạy: docker ps
2. Service logs: docker logs user-service
3. Database connection
4. API Gateway routing

K6 Documentation: https://k6.io/docs/

