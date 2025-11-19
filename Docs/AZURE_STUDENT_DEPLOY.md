# Azure Student - Deployment Guide (portal-only, for this repo)

Tài liệu ngắn gọn để deploy project microservices (Node.js, Kafka, Redis, PostgreSQL, API Gateway, Frontend) lên Azure phù hợp với gói Student và thao tác hoàn toàn qua Azure Portal.

---

## 1. Mục tiêu & giả định
- Mục tiêu: Deploy demo/CI-CD (không dùng AKS), sử dụng App Service for Containers cho mỗi microservice và frontend.
- Giả định bạn đã có: App Service Plan (Linux), Azure Container Registry (ACR) chứa image của các service, PostgreSQL (Azure Database for PostgreSQL).
- Bạn thao tác hoàn toàn trên Azure Portal (không terminal).

---

## 2. Tổng quan ngắn (lý tưởng cho student)
- Resource cần tạo qua Portal:
  - Azure Cache for Redis (C0/basics)
  - Managed Kafka provider: Confluent Cloud free tier (khuyến nghị) hoặc Azure Event Hubs (Kafka endpoint)
  - Web App for Containers (mỗi microservice 1 Web App) + Web App for Frontend hoặc Static Web App
  - (Tuỳ chọn) Azure Key Vault để lưu secrets
- Lý do: App Service + ACR + Redis + managed Kafka đủ cho demo, rẻ và đơn giản hơn AKS.

---

## 3. Những environment variables quan trọng (từ code repo)
- Chung / DB:
  - DATABASE_URL = `postgresql://USER:PASSWORD@HOST:PORT/DBNAME`
  - JWT_SECRET_KEY
- Redis (cart, order sessions):
  - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB
  - (nếu TLS) REDIS_TLS = "true"
- Kafka (payment, order, notification, product services):
  - KAFKA_BROKERS (comma-separated), KAFKA_SASL_USERNAME, KAFKA_SASL_PASSWORD, KAFKA_SSL
- VNPAY (payment-service):
  - VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_API_URL, VNPAY_RETURN_URL (public HTTPS)
- 각 서비스별 Port (mặc định repo dùng nhiều port; App Service container cần WEBSITES_PORT hoặc PORT app setting)

Bạn có file `.env` cho `user-service` (ví dụ) chứa DATABASE_URL pointing to docker service `user-db` — trên Azure bạn sẽ đổi sang Azure Postgres connection string.

---

## 4. Ưu tiên & Quy trình triển khai (portal-only) — phiên bản đã sắp xếp theo priority
Dưới đây là quy trình được sắp xếp theo mức ưu tiên (dành cho môi trường Student / demo). Làm theo thứ tự để giảm rủi ro và debug dễ hơn.

Checklist ngắn (thực hiện theo thứ tự):
- [ ] A. Chuẩn bị infra cốt lõi: PostgreSQL (bạn đã có), Azure Cache for Redis, Confluent Cloud (Kafka)
- [ ] B. Chuẩn bị hình ảnh container: build image, chạy migration nếu muốn (push lên ACR)
- [ ] C. Deploy core services (tạo Web App): api-gateway, order-service, payment-service
- [ ] D. Deploy supporting services: user-service, product-service, restaurant-service, cart-service, notification-service
- [ ] E. Deploy frontend (Web App từ ACR) và cấu hình API endpoint
- [ ] F. Kích hoạt CI/CD (ACR -> Web App) và monitoring (Log stream, Application Insights)
- [ ] G. Smoke test end-to-end: payment + VNPay callback, Redis session, Kafka events

Chi tiết từng bước (mỗi bước là thao tác trên Azure Portal):

A) Chuẩn bị infra cốt lõi (ưu tiên cao - làm ngay)
1. PostgreSQL: (bạn đã có) – kiểm tra connection string và quyền truy cập từ App Services.
2. Azure Cache for Redis (tạo mới nếu chưa có):
   - Portal -> Create -> Azure Cache for Redis -> chọn SKU nhỏ (C0/C1) nếu available.
   - Trong `Networking` chọn Public access (temporary) hoặc Private Endpoint + VNet (nếu bạn cấu hình VNet integration cho App Service).
   - Lưu `Host name` và `Primary key`.
   - Ghi: Azure Redis dùng TLS trên port 6380. Bạn sẽ set App Settings:
     - REDIS_HOST = <host-name>
     - REDIS_PORT = 6380
     - REDIS_PASSWORD = <primary-key>
     - REDIS_TLS = true
   - Nếu bạn cần non-TLS (chỉ cho dev), bật "Allow non-TLS" trong Redis (nếu có trên SKU) và dùng port 6379.
3. Kafka (Confluent Cloud) — khuyến nghị dùng Confluent (nhẹ, free tier):
   - Đăng ký Confluent Cloud (free tier) → tạo một Kafka cluster (Basic hoặc Developer).
   - Trong Confluent UI, tạo một API key (Client ID) và API secret cho cluster.
   - Lấy `Bootstrap servers` (ví dụ: pkc-xxxx.us-east1.gcp.confluent.cloud:9092)
   - Note Confluent yêu cầu SSL/SASL PLAIN. App Settings cần:
     - KAFKA_BROKERS = <bootstrap_servers> (comma-separated nếu nhiều)
     - KAFKA_SASL_USERNAME = <API_KEY>
     - KAFKA_SASL_PASSWORD = <API_SECRET>
     - KAFKA_SSL = true
   - Trong Confluent, tạo các topic cần dùng: order.create, payment.event, order.expired, order.retry.payment, inventory.reserve.result, product.sync

B) Chuẩn bị image & migrations (ưu tiên cao — làm trước khi deploy services)
1. Nếu cần sửa code nhỏ (KAFKA_BROKERS, REDIS_TLS) — áp vào branch demo, build image.
2. Trong Dockerfile/entrypoint, thêm bước chạy Prisma migration (npx prisma migrate deploy) hoặc đảm bảo DB schema đã có trên Postgres.
3. Build image cho mỗi service và push lên ACR. Đảm bảo tag rõ ràng (ví dụ order-service:latest hoặc order-service:v1).

C) Deploy core services trên App Service (ưu tiên: core để test flow)
1. Tạo Web App container cho `api-gateway` (image từ ACR). Set App Settings theo phần 7.1.
2. Tạo Web App container cho `order-service`.
3. Tạo Web App container cho `payment-service` (đặt `VNPAY_RETURN_URL` trỏ tới public URL của service).
4. Theo dõi Log stream: kiểm tra kết nối DB/Redis/Kafka.

D) Deploy supporting services
1. Tạo Web App containers cho `user-service`, `product-service`, `restaurant-service`, `cart-service`, `notification-service`.
2. Thiết lập App Settings tương ứng (DB, Redis, Kafka) — xem phần 7.1.
3. Cấu hình API Gateway App Settings để trỏ tới các public URLs của các service.

E) Deploy frontend (ACR -> Web App)
1. Tạo Web App container cho frontend, chọn image từ ACR (Dockerfile ở `frontend/cnpm-fooddelivery` đã expose port 80).
2. App Settings:
   - WEBSITES_PORT = 80
   - VITE_API_BASE / REACT_APP_API_URL = https://{api-gateway-app}.azurewebsites.net
3. Test UI: tạo order -> theo dõi request flow.

F) CI/CD & Monitoring
1. Trong mỗi Web App -> Deployment Center -> bật Continuous Deployment từ ACR (nếu bạn push image thường xuyên).
2. Bật Diagnostic logs / App Service Log Stream.
3. (Optional) Tích hợp Application Insights cho monitoring chi tiết.

G) Smoke tests & Post-deploy checks (cuối cùng)
- Tạo order trên frontend, kiểm tra:
  - order.create được publish (Kafka topic)
  - payment.service tạo paymentUrl (VNPay) và publish payment.event
  - order.service xử lý payment.event và cập nhật DB
  - Redis sessions được xóa/ quản lý theo logic
- Kiểm tra logs để debug và fix lỗi cấu hình (DB, Redis TLS, Kafka SASL).

---

## 5. Những vấn đề hay gặp & cách khắc phục nhanh
- Kafka error (repo dùng hard-coded `"kafka:9092"`):
  - Giải pháp thực tế: dùng Confluent Cloud hoặc Event Hubs và set env `KAFKA_BROKERS` + SASL info; đồng thời áp 1 thay đổi nhỏ trong code (gợi ý dưới) để đọc env.
- Redis TLS: nếu Azure Redis yêu cầu TLS, bật TLS trong client (gợi ý code). Hoặc dùng non-TLS endpoint nếu test.
- Prisma migrations: phải triển khai schema trước khi service khởi chạy hoặc include migrate trong container.

---

## 6. Gợi ý sửa code (rất nhỏ) — bạn có thể áp vào branch demo trước khi build image
> Mục tiêu: làm services đọc Kafka/Redis từ env thay vì hard-coded. Không bắt buộc nhưng rất nên.

A) Kafka (ví dụ snippet để thay thế chỗ `brokers: ["kafka:9092"]`):

```ts
// ...existing code...
const brokers = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const kafkaConfig: any = { clientId: 'payment-service', brokers };
if (process.env.KAFKA_SSL === 'true') kafkaConfig.ssl = true;
if (process.env.KAFKA_SASL_USERNAME) {
  kafkaConfig.sasl = {
    mechanism: 'plain',
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD,
  };
}
const kafka = new Kafka(kafkaConfig);
// ...existing code...
```

B) Redis TLS (ví dụ):
```ts
// ...existing code...
const redisConfig: any = { socket: { host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT || '6379') } };
if (process.env.REDIS_PASSWORD) redisConfig.password = process.env.REDIS_PASSWORD;
if (process.env.REDIS_TLS === 'true') redisConfig.socket.tls = true;
// create client with redisConfig
```

C) Prisma migration trong Dockerfile (entrypoint):
- Thêm step trong Dockerfile/entrypoint:
```sh
# run migration on start
npx prisma migrate deploy
node dist/server.js
```

---

## 7. Mapping env vars tóm tắt (copy/paste nhanh)
- order-service: DATABASE_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, KAFKA_BROKERS, JWT_SECRET_KEY, PORT
- payment-service: DATABASE_URL, KAFKA_BROKERS, VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_API_URL, VNPAY_RETURN_URL, PORT
- cart-service: REDIS_*, DATABASE_URL(optional), PORT
- api-gateway: USER_SERVICE_URL, ORDER_SERVICE_URL, PAYMENT_SERVICE_URL, PRODUCT_SERVICE_URL, RESTAURANT_SERVICE_URL, CART_SERVICE_URL, PORT
- user-service/product-service/restaurant-service: DATABASE_URL, JWT_SECRET_KEY, PORT
- frontend: VITE_API_BASE or REACT_APP_API_URL -> point to API Gateway


## 7.1. Chi tiết theo Web App (env vars + port nội bộ)
Dưới đây là danh sách Web App bạn sẽ tạo trong Portal và các Application Settings (env vars) cần set cho mỗi Web App. Ghi nhớ: App Service expose ứng dụng ra ngoài trên port 80/443, nhưng container nội bộ có thể lắng nghe port khác — set `WEBSITES_PORT` hoặc `PORT` trên App Service bằng giá trị port nội bộ của container.

Lưu ý chung về port: để container lắng nghe đúng port trên App Service:
- Set App Setting `WEBSITES_PORT` = <container-internal-port>
- Set App Setting `PORT` = <container-internal-port> (nhiều app trong repo đọc `process.env.PORT`)
- External public URL của app sẽ là `https://{your-app}.azurewebsites.net` (không cần port)

Danh sách đề xuất (internal port = port container lắng nghe theo code hoặc khuyến nghị):

1) api-gateway
- Internal port: 3000
- App Settings (bắt buộc):
  - PORT = 3000
  - WEBSITES_PORT = 3000
  - USER_SERVICE_URL = https://{your-user-app}.azurewebsites.net
  - ORDER_SERVICE_URL = https://{your-order-app}.azurewebsites.net
  - PAYMENT_SERVICE_URL = https://{your-payment-app}.azurewebsites.net
  - PRODUCT_SERVICE_URL = https://{your-product-app}.azurewebsites.net
  - RESTAURANT_SERVICE_URL = https://{your-restaurant-app}.azurewebsites.net
  - CART_SERVICE_URL = https://{your-cart-app}.azurewebsites.net
- Notes: set the above to the public Azure Web App URLs (https). Do NOT use docker hostnames like `order-service:2000` on App Service.

2) user-service
- Internal port: 3003 (from `server.ts` default)
- App Settings:
  - PORT = 3003
  - WEBSITES_PORT = 3003
  - DATABASE_URL
  - JWT_SECRET_KEY
- Optional: extra DB/redis related envs if used by user-service

3) product-service
- Internal port: 3004
- App Settings:
  - PORT = 3004
  - WEBSITES_PORT = 3004
  - DATABASE_URL (if product-service uses Prisma)
  - KAFKA_BROKERS (if you use product Kafka consumer)
  - JWT_SECRET_KEY (middleware verifies tokens)

4) restaurant-service
- Internal port: 3005
- App Settings:
  - PORT = 3005
  - WEBSITES_PORT = 3005
  - DATABASE_URL
  - JWT_SECRET_KEY

5) cart-service
- Internal port: 3006
- App Settings:
  - PORT = 3006
  - WEBSITES_PORT = 3006
  - REDIS_HOST
  - REDIS_PORT
  - REDIS_PASSWORD
  - (optional) DATABASE_URL

6) order-service
- Internal port: recommended 2000 (the code uses `process.env.PORT` with no default; choose a fixed port)
- App Settings:
  - PORT = 2000
  - WEBSITES_PORT = 2000
  - DATABASE_URL
  - REDIS_HOST
  - REDIS_PORT
  - REDIS_PASSWORD
  - REDIS_DB
  - KAFKA_BROKERS
  - JWT_SECRET_KEY
- Note: you may also set PORT to a different value (e.g., 3002) but ensure API Gateway's URLs point to the Gateway public URL so internal port mismatch won't matter.

7) payment-service
- Internal port: recommended 4000 (server uses `process.env.PORT` so set it explicitly)
- App Settings:
  - PORT = 4000
  - WEBSITES_PORT = 4000
  - DATABASE_URL
  - KAFKA_BROKERS
  - VNPAY_TMN_CODE
  - VNPAY_HASH_SECRET
  - VNPAY_API_URL
  - VNPAY_RETURN_URL (public HTTPS e.g. https://{payment-app}.azurewebsites.net/vnpay_return)
  - JWT_SECRET_KEY (if verifying tokens)

8) notification-service
- Internal port: recommend 5000 (set explicit)
- App Settings:
  - PORT = 5000
  - WEBSITES_PORT = 5000
  - KAFKA_BROKERS
  - DATABASE_URL (if used)

9) frontend (container from ACR with Nginx)
- Dockerfile exposes port 80 (nginx default)
- App Settings:
  - WEBSITES_PORT = 80
  - (optional build-time envs baked into image) VITE_API_BASE or REACT_APP_API_URL = https://{api-gateway-app}.azurewebsites.net
- Notes: since the frontend is static served by nginx on port 80, set `WEBSITES_PORT = 80`. Public URL will be `https://{frontend-app}.azurewebsites.net`.

10) misc / helper notes about ports
- App Service expects a single container port to forward traffic to — `WEBSITES_PORT` tells Azure which port inside the container to route to.
- Always set both `WEBSITES_PORT` and `PORT` (some code reads `process.env.PORT`).
- External URLs (used by API Gateway and frontend) should be the `https://{app}.azurewebsites.net` (no port) — do NOT append the internal port.
- If you change any internal port values, update API Gateway's upstream URLs to point to the public URL of target apps (recommended) rather than relying on internal port numbers.

---

## 8. Smoke test checklist
- [ ] Each service container starts (check Log stream)
- [ ] Prisma connects (no migration errors)
- [ ] Redis connected (no TLS errors)
- [ ] Kafka consumer/producer connected (no auth errors)
- [ ] API Gateway routes to services
- [ ] Frontend can create order and reach payment URL
- [ ] VNPay return IPN works (callback URL reachable)

---

## 9. Tóm tắt ngắn, quyết định cho student
- Use App Service for Containers + ACR + Azure Cache for Redis + Confluent Cloud (Kafka) → ít cấu hình infra, dễ dùng portal.
- Một thay đổi code nhỏ (env-driven Kafka + Redis TLS) rất khuyến nghị — thực hiện trên branch demo, build image và push lên ACR.

---

Nếu bạn muốn, tôi sẽ:
- Sinh 1 bảng (CSV hoặc checklist) env vars chi tiết cho từng service để bạn copy/paste vào Portal, hoặc
- Viết PR patch nhỏ (code changes) giúp Kafka/Redis read từ env (tôi chỉ tạo patch trên branch bạn yêu cầu).

Bạn muốn tôi làm bước nào tiếp theo? (1) Tạo file CSV env list, (2) Viết đoạn patch code gợi ý, (3) Hướng dẫn chi tiết từng Web App (tên, image tag) để bạn copy/paste.

## 10. Chiến lược môi trường (env): Local vs Azure — chỉ dẫn cụ thể
Ở đây tôi nêu rõ cách bạn nên quản lý biến môi trường khi phát triển local và khi deploy lên Azure, cùng với các bước thực hiện cụ thể.

1) Nguyên tắc chung
- Local development: dùng file `.env` trong từng service (hoặc root monorepo nếu bạn có script quản lý) để lưu các biến như `DATABASE_URL`, `REDIS_HOST`, `KAFKA_BROKERS`, `VNPAY_*`, `JWT_SECRET_KEY`…
- Azure (production/demo trên App Service): không dùng file `.env` trong container; thay vào đó đặt các biến trong **App Service -> Configuration -> Application settings** (Portal). Azure sẽ inject các giá trị đó thành `process.env` trong container.
- Priority / precedence: App Service Application settings (và Key Vault references) sẽ override bất kỳ biến môi trường nào được định nghĩa trong container image. Vì vậy khi deploy lên Azure, đảm bảo đặt tất cả biến quan trọng trong App Settings.

2) Cách map biến cụ thể (local .env -> Azure App Settings)
- `DATABASE_URL` (local .env) -> tạo App Setting `DATABASE_URL` với connection string của Azure Postgres.
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` (local) -> tạo App Settings tương ứng. Nếu sử dụng Azure Cache for Redis có TLS, set `REDIS_PORT=6380` và `REDIS_TLS=true`.
- `KAFKA_BROKERS`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`, `KAFKA_SSL` (local) -> tạo App Settings tương ứng. Ví dụ `KAFKA_BROKERS=pkc-xxx.confluent.cloud:9092`.
- `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_API_URL`, `VNPAY_RETURN_URL` -> set trong App Settings (hoặc lưu trong Key Vault và tham chiếu từ App Settings).
- `JWT_SECRET_KEY` -> set trong App Settings / Key Vault.
- `PORT` / `WEBSITES_PORT` -> set `PORT=<internal-port>` và `WEBSITES_PORT=<internal-port>` như phần 7.1 hướng dẫn.

3) Khi code có fallback (ví dụ `process.env.PORT || 3003`) — kết luận
- Nếu code đã có fallback (ví dụ user-service, product-service, v.v.), bạn có thể để nguyên và Azure sẽ cung cấp `PORT` từ App Settings.
- Nếu code hard-code giá trị (ví dụ `brokers: ['kafka:9092']`), bạn cần sửa để đọc từ env (hoặc đảm bảo infra cung cấp host `kafka` — không khả thi trên App Service). Tôi khuyến nghị sửa code nhỏ (xem phần 6 Gợi ý sửa code) và rebuild image.

4) Cụ thể: có cần sửa code không? (câu trả lời ngắn)
- Có **nên** sửa 1 vài chỗ nhỏ để production/Azure hoạt động trơn tru:
  - Thay `brokers: ['kafka:9092']` thành đọc `process.env.KAFKA_BROKERS` (nếu có), hỗ trợ SASL/SSL.
  - Thêm hỗ trợ `REDIS_TLS` nếu dùng Azure Redis TLS port.
  - Thêm `npx prisma migrate deploy` trong entrypoint hoặc CI để đảm bảo schema trên Azure.
- Nếu bạn không muốn sửa code: bạn phải reproduce môi trường Docker-Compose giống local (cài đặt một broker Kafka với hostname `kafka` và Redis non-TLS) trên Azure (phức tạp) — nên tránh.

5) Các bước cụ thể khi chuyển từ local -> Azure
- Trên máy local:
  - Giữ file `.env` để phát triển và test.
  - Khi muốn build image để push ACR cho Azure, đảm bảo:
    - Nếu bạn đã sửa code để đọc env, build image bình thường (không embed secrets).
    - Không commit `.env` vào git.
- Trên Azure Portal (cho mỗi Web App):
  - Vào `Configuration` -> `Application settings` -> Add setting (Key / Value) tương ứng (ví dụ `DATABASE_URL`, `REDIS_HOST`, v.v.).
  - Với secrets nhạy cảm, lưu vào **Key Vault** và dùng Key Vault reference trong App Setting (giá trị kiểu `@Microsoft.KeyVault(SecretUri=...)`).
  - Set `WEBSITES_PORT` và `PORT` theo hướng dẫn ở phần 7.1.
- Deploy image từ ACR: dùng Deployment Center hoặc chọn image trực tiếp lúc tạo Web App.

6) Mẹo kiểm tra sau deploy
- Mở `Log stream` trong App Service để xem stdout/stderr — sẽ thấy service log `Connected to Redis` hoặc `Kafka connected` nếu ok.
- Nếu service báo `ECONNREFUSED kafka:9092` thì chắc chắn vẫn còn hard-coded "kafka" trong code — phải sửa code và rebuild image.
- Nếu Redis báo lỗi TLS, kiểm tra `REDIS_TLS` và port là 6380.

7) Ví dụ thực tế (các file cần sửa nếu bạn chấp nhận thay đổi nhỏ)
- File cần sửa (ví dụ):
  - `backend/services/payment-service/src/utils/kafka.ts` (và tương tự `order-service`, `notification-service`, `product-service`): thay `brokers: ['kafka:9092']` bằng code đọc env `KAFKA_BROKERS`.
  - `backend/services/*/src/config/redis.ts` (nơi config redis): thêm đọc `REDIS_TLS` và set TLS trong createClient config.
- Snippet Kafka (nhắc lại) — dán vào các file utils/kafka.ts nơi cần:
```ts
const brokers = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const kafkaConfig: any = { clientId: 'your-service-name', brokers };
if (process.env.KAFKA_SSL === 'true') kafkaConfig.ssl = true;
if (process.env.KAFKA_SASL_USERNAME) kafkaConfig.sasl = {
  mechanism: 'plain',
  username: process.env.KAFKA_SASL_USERNAME,
  password: process.env.KAFKA_SASL_PASSWORD,
};
const kafka = new Kafka(kafkaConfig);
```
- Snippet Redis TLS (ví dụ):
```ts
const redisConfig: any = { socket: { host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT || '6379') } };
if (process.env.REDIS_PASSWORD) redisConfig.password = process.env.REDIS_PASSWORD;
if (process.env.REDIS_TLS === 'true') redisConfig.socket.tls = true; // client redis v4
const client = createClient(redisConfig);
```

8) Kết luận ngắn gọn (thực hiện ngay):
- Để deploy lên Azure dễ dàng: sửa code nhỏ theo phần 6/7 (KAFKA_BROKERS, REDIS_TLS), build image mới, push ACR, rồi set toàn bộ biến trong App Service -> Configuration.
- Nếu không sửa code: bạn cần deploy Kafka/Redis theo đúng hostnames và ports giống local (khó và không recommended trên App Service).

---

## 11. Hướng dẫn cấu hình Azure Database for PostgreSQL (bước-by-bước, chi tiết)
Nếu bạn nghĩ mình đã cấu hình PostgreSQL sai, làm theo hướng dẫn này để kiểm tra và (nếu cần) tạo hoặc sửa lại server PostgreSQL trên Azure sao cho đúng với yêu cầu của project (Prisma, App Service).

Mục tiêu:
- Tạo (hoặc sửa) Azure Database for PostgreSQL phù hợp cho demo/student
- Đảm bảo App Services có thể kết nối (firewall / networking)
- Cấu hình connection string đúng cho `DATABASE_URL` (dùng với Prisma)
- Cung cấp các lựa chọn an toàn/tạm thời khi debug (TLS, firewall)

Lưu ý: Azure hiện có 2 flavour chính: "Flexible Server" (khuyến nghị mới) và "Single Server" (legacy). Hướng dẫn dưới áp dụng cho Flexible Server; Single Server tương tự ở nhiều bước.

A) Tạo server PostgreSQL (Portal)
1. Portal -> Create a resource -> Databases -> Azure Database for PostgreSQL -> Flexible Server
2. Basic cấu hình cho student/demo:
   - Subscription, Resource group
   - Server name: ví dụ `foodpay-db` (tên phải là unique)
   - Region: chọn gần bạn (ví dụ East US / Southeast Asia)
   - Workload type / Compute + Storage: chọn General Purpose nhỏ nhất hoặc Burstable nếu có (B1ms / 1 vCore) để tiết kiệm chi phí
   - Authentication: admin username (ví dụ `pgadmin`) và mật khẩu mạnh
   - Public access: allow public access (tạm thời) hoặc chọn VNet/private endpoint nếu bạn cấu hình VNet cho App Service (nâng cao)
3. Networking / Connectivity:
   - Nếu bạn chọn Public access, bật `Allow public access from any Azure service` (tùy chọn) hoặc kiểm soát bằng firewall rules.
   - Lưu ý: tốt nhất là thêm firewall rule chỉ cho IP(s) của App Service (xem phần B).
4. Data encryption / backups: giữ mặc định cho demo.
5. Create server và chờ provisioning hoàn tất.

B) Cấu hình firewall & kết nối từ App Service
App Service cần được phép truy cập tới server PostgreSQL. Có 2 cách chính:
- Cách nhanh (dùng cho demo): bật `Allow access to Azure services` trong PostgreSQL server -> App Service sẽ có thể kết nối.
- Cách an toàn hơn: add firewall rules cho các Outbound IP của App Service.

1. Lấy danh sách Outbound IPs của App Service:
   - Trong Portal -> App Service của bạn -> Properties -> Copy `Outbound IP addresses` list.
   - Lưu ý: App Service có nhiều outbound IPs (comma separated) — bạn cần add tất cả vào firewall của PostgreSQL.
2. Thêm firewall rules vào PostgreSQL server:
   - Portal -> your PostgreSQL server -> Networking -> Add client IP (hoặc Add rule) -> nhập từng IP hoặc dải IP.
   - Lưu lại.
3. Kiểm tra kết nối bằng Query Editor (Portal) hoặc công cụ như pgAdmin (nếu bạn muốn test từ máy local, nhớ add IP của laptop vào firewall).

C) Connection string / `DATABASE_URL` cho Prisma (ví dụ & lưu ý)
- Format chuẩn (khuyến nghị cho Prisma):

  postgresql://<USERNAME>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=public&sslmode=require

- Lưu ý quan trọng với Azure:
  - Tên user có thể cần định dạng `username@servername` tùy server SKU — nếu kết nối lỗi, thử dùng `username@servername` như username hoặc URL-encode ký tự `@` (thành `%40`) trong connection string.
  - Ví dụ (thông dụng):

    DATABASE_URL="postgresql://pgadmin:MyP@ssw0rd@foodpay-db.postgres.database.azure.com:5432/foodpaydb?schema=public&sslmode=require"

  - Nếu username là `pgadmin@foodpay-db`, URL-encode:

    DATABASE_URL="postgresql://pgadmin%40foodpay-db:MyP%40ssw0rd@foodpay-db.postgres.database.azure.com:5432/foodpaydb?schema=public&sslmode=require"

- Cách set vào App Service: Portal -> Web App -> Configuration -> Application settings -> Add `DATABASE_URL` = <giá trị ở trên>

D) SSL / CA Certificate
- Azure PostgreSQL bắt buộc SSL (Flexible Server) — set `sslmode=require` sẽ bắt buộc kết nối TLS.
- Đối với Prisma/Node, `sslmode=require` trong connection string thường là đủ. Nếu client báo lỗi `self signed certificate` bạn có 2 lựa chọn:
  - Bật `rejectUnauthorized=false` trong client (không khuyến nghị cho production) — bằng cách cấu hình prisma client trong code (ví dụ qua `ssl` option).
  - Hoặc dùng CA certificate chính thức (tải từ Azure docs) và cấu hình client trust (phức tạp hơn).
- Với Prisma, start bằng `sslmode=require` trong `DATABASE_URL` là phù hợp cho demo.

E) Migration (tạo schema) — các lựa chọn
1. Chạy migration local (nếu bạn có terminal + prisma CLI):
   - Từ máy dev (có kết nối tới Azure DB), set env `DATABASE_URL` rồi chạy:

```bash
npx prisma migrate deploy
```

   - Hoặc để chạy migration đặc thù: `npx prisma migrate dev` (local dev only).
2. Chạy migration tự động khi container khởi động (được khuyến nghị cho CI/CD/demo):
   - Trong Dockerfile hoặc entrypoint script, thêm lệnh trước khi khởi chạy app:

```dockerfile
# Dockerfile (entrypoint snippet)
# ...existing code...
CMD npx prisma migrate deploy && node dist/server.js
```

   - Sau đó build image, push ACR, và deploy Web App. Khi container start nó sẽ chạy migration và exit to app.
3. Dùng Query Editor trong Azure Portal (nếu bạn có SQL script):
   - Portal -> PostgreSQL server -> Query editor (preview) -> đăng nhập bằng admin -> chạy các lệnh SQL để tạo bảng.

F) Thao tác kiểm tra & Debug (nếu không kết nối)
- Kiểm tra logs ở App Service (Log stream): sẽ thấy lỗi liên quan đến authentication hoặc SSL.
- Lỗi phổ biến và cách fix:
  - `password authentication failed` → kiểm tra username/password, nếu username cần `@servername` thì sửa accordingly.
  - `timeout` hoặc `connect ECONNREFUSED` → kiểm tra firewall, add outbound IPs hoặc bật `Allow Azure services` tạm thời.
  - `self signed certificate` → thử thêm `?sslmode=require` hoặc cấu hình client để chấp nhận CA.
- Để debug nhanh: thử kết nối từ máy local bằng `psql` hoặc pgAdmin (nhớ add IP của máy local vào firewall).

G) Tối ưu cho Student/demo
- Chọn SKU nhỏ, bật auto pause nếu có để tiết kiệm chi phí.
- Nếu lo ngại số lượng kết nối (Prisma tạo nhiều connection), cân nhắc chạy bản build có `pgbouncer` hoặc setting connection pool trong Prisma v4 (datasource `pgbouncer` support) — nhưng cho demo có thể để mặc định.

H) Ví dụ concrete để copy/paste vào App Settings
- DATABASE_URL = postgresql://pgadmin:MyP@ssw0rd@foodpay-db.postgres.database.azure.com:5432/foodpaydb?schema=public&sslmode=require
- (nếu username = pgadmin@foodpay-db):
  - DATABASE_URL = postgresql://pgadmin%40foodpay-db:MyP%40ssw0rd@foodpay-db.postgres.database.azure.com:5432/foodpaydb?schema=public&sslmode=require


---

Kết luận & bước tiếp theo tôi có thể làm cho bạn
- Tôi đã thêm nội dung này vào `AZURE_STUDENT_DEPLOY.md` trong repo.
- Nếu muốn, tôi có thể tiếp tục và làm 1 trong các việc sau (chọn 1):
  1) Tạo file CSV/Checklist env vars chi tiết để bạn copy/paste vào Portal (rất tiện)
  2) Tạo patch (gợi ý) thay code để chạy `KAFKA_BROKERS` + `REDIS_TLS` và tự động chạy migration; tôi sẽ tạo edits trong repo trên branch `demo/azure-env` (bạn review)
  3) Soạn danh sách Web App names + ví dụ image tags từ ACR để bạn copy/paste khi tạo Web Apps trên Portal

Bạn chọn 1, 2, hay 3 (hoặc yêu cầu khác)?

## 12. Kafka & Redis — cấu hình chi tiết: Test (local) vs Deploy (Azure)
Phần này hướng dẫn rõ ràng cách đặt biến môi trường cho Kafka và Redis ở hai môi trường: khi test/local và khi deploy lên Azure App Service.

### 12.1 Kafka
- Mục tiêu: Producer/Consumer (order-service, payment-service, notification-service, product-service) kết nối ổn định.
- Lưu ý code: repo gốc hard-code `brokers: ["kafka:9092"]` trong nhiều service. Bạn nên áp gợi ý sửa code ở mục 6 để đọc env `KAFKA_*`. Nếu không sửa, App Service sẽ không thể resolve hostname `kafka`.

A) Test / Local (Docker hoặc máy dev)
- Env khuyến nghị:
  - KAFKA_BROKERS = localhost:9092 (nếu Kafka chạy local) hoặc kafka:9092 (nếu chạy bằng docker-compose và service tên `kafka`)
  - KAFKA_SSL = false
  - (không cần) KAFKA_SASL_USERNAME, KAFKA_SASL_PASSWORD
  - KAFKA_GROUP_ID = <ten-service>-group (ví dụ payment-service-group)
- Topics cần có (tạo sẵn trong local broker):
  - order.create, payment.event, order.expired, order.retry.payment, inventory.reserve.result, product.sync
- Dấu hiệu lỗi thường gặp local:
  - `ECONNREFUSED localhost:9092` → broker chưa chạy
  - `ENOTFOUND kafka` → sai hostname khi không dùng docker-compose

B) Deploy / Azure (Confluent Cloud — khuyến nghị)
- Tạo cluster Confluent Cloud (free tier) → tạo API Key/Secret → lấy Bootstrap servers.
- App Settings cho từng service Kafka client:
  - KAFKA_BROKERS = pkc-xxxxx.region.confluent.cloud:9092
  - KAFKA_SASL_USERNAME = <Confluent API Key>
  - KAFKA_SASL_PASSWORD = <Confluent API Secret>
  - KAFKA_SSL = true
  - KAFKA_GROUP_ID = <ten-service>-group (ví dụ order-service-group)
  - (khuyến nghị) SERVICE_NAME = order-service (để set clientId đẹp; xem mục clientId giải thích ở dưới)
- Tạo topics trên Confluent: order.create, payment.event, order.expired, order.retry.payment, inventory.reserve.result, product.sync
- Dấu hiệu lỗi thường gặp deploy:
  - `SASL authentication failed` → sai API key/secret
  - `getaddrinfo ENOTFOUND pkc-xxxxx...` → sai hostname/bootstrap servers
  - `self signed certificate` thường không xuất hiện với Confluent; luôn để `KAFKA_SSL=true`
- clientId khuyến nghị: `clientId = ${SERVICE_NAME}-${WEBSITE_INSTANCE_ID || process.pid}` để phân biệt instance trong logs.


### 12.2 Redis
- Mục tiêu: cart-service và order-service kết nối Redis ổn định; quản lý session đúng TTL.

A) Test / Local
- Nếu chạy docker-compose có service `redis`:
  - REDIS_HOST = redis
  - REDIS_PORT = 6379
  - REDIS_PASSWORD = (để trống nếu bạn không cấu hình password)
  - REDIS_DB = 0 (tùy chọn)
  - REDIS_TLS = false
- Nếu chạy Redis trên máy local:
  - REDIS_HOST = localhost
  - REDIS_PORT = 6379
  - REDIS_TLS = false

B) Deploy / Azure (Azure Cache for Redis — TLS)
- Lấy thông tin từ Azure Cache for Redis (Portal):
  - Host name: ví dụ myredis.redis.cache.windows.net
  - TLS port: 6380
  - Access keys: Primary key
- App Settings cho các service dùng Redis (cart, order,…):
  - REDIS_HOST = myredis.redis.cache.windows.net
  - REDIS_PORT = 6380
  - REDIS_PASSWORD = <Primary key>
  - REDIS_DB = 0 (tùy chọn)
  - REDIS_TLS = true
- Lưu ý Networking:
  - Public access: đảm bảo App Service có thể outbound. Nếu bật firewall, add Outbound IPs của App Service.
  - Private endpoint + VNet: nâng cao, chỉ dùng khi bạn đã cấu hình VNet integration cho App Service.
- Dấu hiệu lỗi thường gặp deploy:
  - `NOAUTH Authentication required` → thiếu REDIS_PASSWORD
  - `ERR Client sent AUTH, but no password is set` → bạn set password nhưng Redis đang không yêu cầu (ít gặp với Azure)
  - `read ECONNRESET` hoặc handshake lỗi → thiếu REDIS_TLS=true hoặc sai port (phải 6380)


### 12.3 Ví dụ cấu hình nhanh (copy App Settings theo môi trường)
A) Local/Test (ví dụ cho payment-service)
- KAFKA_BROKERS = localhost:9092
- KAFKA_SSL = false
- KAFKA_GROUP_ID = payment-service-group
- REDIS_HOST = localhost
- REDIS_PORT = 6379
- REDIS_TLS = false

B) Deploy/Azure (ví dụ cho payment-service)
- KAFKA_BROKERS = pkc-xxxxx.region.confluent.cloud:9092
- KAFKA_SASL_USERNAME = <API_KEY>
- KAFKA_SASL_PASSWORD = <API_SECRET>
- KAFKA_SSL = true
- KAFKA_GROUP_ID = payment-service-group
- REDIS_HOST = myredis.redis.cache.windows.net
- REDIS_PORT = 6380
- REDIS_PASSWORD = <Primary key>
- REDIS_TLS = true

> Nhắc lại: để dùng được các env này, các file Kafka client phải đọc từ env (mục 6). Nếu còn hard-code `kafka:9092`, App Service sẽ không kết nối được.


## 13. Lưu ý thêm (quan trọng – review nhanh)
- API Gateway CORS: cập nhật origin cho frontend domain (mặc định code để localhost). Trên deploy, đổi origin thành `https://{frontend-app}.azurewebsites.net`.
- VNPay return URL: đảm bảo `VNPAY_RETURN_URL` khớp đúng endpoint public trên payment-service và đã đăng ký trong VNPay portal.
- Always On: bật trong App Service (General settings) để tránh cold-start lâu với consumer Kafka.
- NODE_ENV: set `NODE_ENV=production` trong App Settings để tối ưu hiệu năng và logs.
- App Service Plan quotas: với Student, chọn SKU nhỏ nhưng đảm bảo đủ bộ nhớ cho Node + Kafka client.
- Deployment Center: đồng bộ image tag giữa ACR và Web App (tránh trỏ nhầm tag cũ).
- Consumer group IDs: mỗi service nên có groupId riêng, tránh share group gây rebalancing khó đoán nếu không chủ đích.
- Prisma migrations: đừng quên chạy trước khi test end-to-end trên Azure.
- Health checks: thêm route “/” đã có; bạn có thể bật Health check trong App Service để auto-restart khi lỗi (optional).

