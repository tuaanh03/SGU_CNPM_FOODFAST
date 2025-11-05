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

## 4. Bước-by-bước (Portal-only)
(Thực hiện theo thứ tự)

### Bước A — Tạo/kiểm tra infra cơ bản
1. Redis:
   - Portal -> Create -> Azure Cache for Redis -> Chọn SKU nhỏ nhất (C0 nếu có)
   - Lưu host name và primary key
   - Note: Azure Redis mặc định dùng TLS (port 6380). Ghi lại cổng và key.
2. Kafka:
   - Cách nhanh: Tạo Confluent Cloud (external): tạo cluster free, lấy bootstrap servers và API key/secret.
   - Hoặc: Portal -> Event Hubs Namespace -> sử dụng Kafka endpoint (cũng được). Lấy namespace FQDN và connection string.
   - Ghi lại bootstrap servers / connection info.
3. PostgreSQL: bạn đã có — đảm bảo Database user và DB name đã sẵn sàng và cho phép kết nối từ App Services (với public access hoặc private endpoint).

### Bước B — App Service: tạo Web App for Containers (mỗi microservice)
Lặp cho từng service: `api-gateway`, `order-service`, `payment-service`, `cart-service`, `notification-service`, `product-service`, `restaurant-service`, `user-service`, `frontend` (hoặc dùng Static Web App cho frontend)

1. Portal -> Create -> Web App
   - Publish: Docker Container
   - OS: Linux
   - App Service Plan: chọn plan bạn đã có
2. Deployment -> Docker -> Image source: Azure Container Registry -> chọn repository và tag
3. Configuration -> Application settings: thêm env vars cần cho service (ví dụ `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `KAFKA_BROKERS`, `VNPAY_RETURN_URL`, `JWT_SECRET_KEY`, v.v.)
   - Nếu container định lắng nghe port khác 80, set `WEBSITES_PORT` hoặc `PORT` = container port (ví dụ 3000)
4. Monitoring -> Enable container logs để xem output trong Portal
5. Deployment Center -> Bật Continuous Deployment từ ACR (nếu muốn tự động deploy khi push image)
6. Networking -> Nếu muốn kết nối private tới Postgres/Redis, cấu hình VNet integration và private endpoints (nâng cao)

### Bước C — Cấu hình API Gateway và Frontend
1. Khi mỗi service có URL `https://{app}.azurewebsites.net`, copy các URL và set những biến trong `api-gateway` App Settings:
   - USER_SERVICE_URL, ORDER_SERVICE_URL, PAYMENT_SERVICE_URL, PRODUCT_SERVICE_URL, RESTAURANT_SERVICE_URL, CART_SERVICE_URL
2. Frontend: nếu build thời gian runtime (container) dùng image từ ACR; nếu dùng Static Web App, cấu hình build & môi trường để gọi API Gateway public URL.

### Bước D — VNPay (payment callback)
1. Trong `payment-service` App Settings: set `VNPAY_RETURN_URL` = `https://{payment-app}.azurewebsites.net/api/payment/<return-endpoint>`
2. Đăng ký URL này trong VNPay merchant portal (sandbox)

### Bước E — Prisma migrations
- Nếu DB chưa có schema, bạn cần chạy prisma migrate. Options:
  1. Build image chứa step `npx prisma migrate deploy` trong entrypoint/ Dockerfile (recommended) — sau đó redeploy image.
  2. Tạm thời tạo một Web App Container chỉ chạy migration once (use same image with command override to run migration) then stop.

### Bước F — Test & Debug
- Portal -> App Service -> Log stream: xem logs khi container start
- Test endpoints (API gateway, services)
- Test flow: frontend -> create order -> payment flow -> VNPay return
- Check Redis connect logs and Kafka connect logs.

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
