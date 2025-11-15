# K6 Load Test for Microservices

## Overview
- **Scenario**: Gradually ramp up to 1000 virtual users (VUs) over 30 minutes
- **Stages**:
  - 0-2min: Warm up to 100 VUs
  - 2-7min: Ramp up to 500 VUs  
  - 7-15min: Reach peak 1000 VUs
  - 15-25min: Sustain 1000 VUs
  - 25-30min: Ramp down to 0
- **Flow per VU**:
  1. Register unique account (/api/auth/register) - **creates real user in DB**
  2. Login (/api/auth/login) to get JWT
  3. Browse menu (/api/restaurants/:storeId/menu)
  4. Add 3 items to cart (/api/cart/add)
  5. Create order (/api/order/create-from-cart)

## ⚠️ Important Warnings

### Database Impact
- **Each VU creates a REAL user account** in your database
- Running full test = **1000+ user accounts** created in `user-db`
- **Each iteration creates orders** in `order-db` (could be thousands)
- **Redis cart entries** will accumulate

### After Test Cleanup
You MUST cleanup test data after running:

```bash
# Example: Delete test accounts (adjust based on your DB schema)
docker exec -it user-db psql -U postgres -d foodfast_user -c "DELETE FROM users WHERE email LIKE 'loaduser+vu%@%';"

# Clear test orders (adjust based on your schema)
docker exec -it order-db psql -U postgres -d foodfast_order -c "DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loaduser+vu%@%');"

# Or full reset (DANGER: deletes all data)
docker-compose down -v
docker-compose up -d
```

## Files
- `k6-load-test.js`: the test script (default parameters configurable via env vars)

## Environment Variables
- `K6_BASE_URL`: base URL for API Gateway (default http://localhost:3000)
- `K6_USER_EMAIL`: base email for generating unique accounts (default loaduser@example.com)
  - Each VU gets: `loaduser+vu1@example.com`, `loaduser+vu2@example.com`, etc.
- `K6_USER_PASS`: password for all test accounts (default password)
- `K6_STORE_ID`: storeId used for browse (default store-1)
- `FALLBACK_PRODUCT_ID`, `FALLBACK_PRODUCT_ID_2`, `FALLBACK_PRODUCT_ID_3`: fallback product ids if browse returns none
- `K6_ALLOW_SHARED_LOGIN`: if 'true', VUs will fallback to shared account if register/login fails

## Prerequisites

### 1. Install k6
https://k6.io/docs/getting-started/installation

### 2. Ensure Products Exist
The script expects at least 3 products in `store-1`. You need to:
- Seed products via admin API or migration script
- OR set `FALLBACK_PRODUCT_ID` env vars to existing product IDs

### 3. Ensure Adequate Resources
- **1000 concurrent users = heavy load**
- Monitor: CPU, Memory, DB connections, Kafka lag
- Use Prometheus/Grafana to observe metrics during test
- Consider using remote k6 cloud or distributed runners for full scale

## Run

### Smoke Test (RECOMMENDED FIRST)
Always start with small test to verify everything works:

```bash
k6 run --vus 10 --duration 1m Tests/LoadTest/k6-load-test.js
```

### Small Test
```bash
k6 run --vus 50 --duration 5m Tests/LoadTest/k6-load-test.js
```

### Full Load Test (30min ramp to 1000 VUs)
```bash
K6_BASE_URL=http://localhost:3000 \
K6_USER_EMAIL=loaduser@example.com \
K6_USER_PASS=password \
k6 run Tests/LoadTest/k6-load-test.js
```

### With Result Export
```bash
k6 run --out json=results.json Tests/LoadTest/k6-load-test.js
```

## What Happens During Test

### Phase 1: Ramp-Up (0-15min)
- VUs gradually increase from 0 → 1000
- Each NEW VU:
  - Registers account (POST /api/auth/register)
  - Logs in to get token (POST /api/auth/login)
  - Starts iteration loop

### Phase 2: Sustain (15-25min)  
- All 1000 VUs running continuously
- Each iteration per VU:
  - Browse menu (1 request)
  - Add 3 items to cart (3 requests)
  - Create order (1 request)
  - Sleep 1-5 seconds (random think time)
  - Repeat

### Phase 3: Ramp-Down (25-30min)
- VUs gradually decrease to 0
- Graceful shutdown

## Expected Results

### Success Metrics
- `http_req_duration p(95) < 2000ms` - 95% of requests under 2s
- `login_success rate > 0.95` - 95%+ successful logins
- `order_success rate > 0.90` - 90%+ successful orders

### Common Issues

**High error rate on register**
- Cause: Email already exists (from previous test run)
- Fix: Cleanup DB or change `K6_USER_EMAIL` base

**Browse menu returns empty**
- Cause: No products in `store-1`
- Fix: Seed products or set `FALLBACK_PRODUCT_ID`

**Add to cart fails**
- Cause: Product IDs don't exist
- Fix: Ensure products seeded with valid IDs

**Create order fails**
- Cause: Cart validation, stock check, or DB constraint
- Fix: Check backend logs for exact error

## Monitoring During Test

Watch these in Grafana:
- API Gateway request rate & latency
- Service CPU/Memory usage
- Database connections & query time
- Kafka consumer lag
- Redis memory usage

## Notes
- The script assumes API Gateway paths match those used in the repo
- If endpoints or payloads differ, update `k6-load-test.js` accordingly
- **DO NOT run full 1000 VU test on local laptop** - use server/cloud
- Consider database indexing on frequently queried fields before running

