# K6 Load Testing Guide - Food Delivery Microservices

**Ngày cập nhật:** 19/11/2025  
**Testing Tool:** k6 (Grafana Labs)  
**Test Types:** Load Testing, Stress Testing, Spike Testing, Soak Testing  
**Reporting:** k6 Cloud, Prometheus, InfluxDB

---

## 📊 Tổng quan k6 Load Testing

### k6 là gì?

k6 là công cụ load testing mã nguồn mở, sử dụng JavaScript để viết test scenarios. Đặc biệt phù hợp với kiến trúc microservices.

### Cài đặt k6

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### Chạy k6 test

```bash
# Chạy local
k6 run script.js

# Với options
k6 run --vus 10 --duration 30s script.js

# Output to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 script.js

# Output to Prometheus
k6 run --out experimental-prometheus-rw script.js
```

---

## 🎯 Test Scenarios cho từng Service

### 1. API Gateway Load Testing

**Mục tiêu:**
- Test khả năng xử lý concurrent requests
- Test rate limiting
- Test proxy performance
- Test CORS handling

**Test Script: `api-gateway-load-test.js`**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const proxyLatency = new Trend('proxy_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 VUs
    { duration: '3m', target: 50 },   // Stay at 50 VUs
    { duration: '1m', target: 100 },  // Ramp up to 100 VUs
    { duration: '3m', target: 100 },  // Stay at 100 VUs
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    'http_req_failed': ['rate<0.05'],                  // Error rate < 5%
    'errors': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_GATEWAY_URL || 'https://api-gateway-service-production-04a1.up.railway.app';

export default function () {
  // Test 1: Get all stores (public endpoint)
  const storesRes = http.get(`${BASE_URL}/api/stores`);
  check(storesRes, {
    'stores status is 200': (r) => r.status === 200,
    'stores response time < 500ms': (r) => r.timings.duration < 500,
    'stores has data': (r) => JSON.parse(r.body).data !== undefined,
  });
  errorRate.add(storesRes.status !== 200);
  proxyLatency.add(storesRes.timings.duration);

  sleep(1);

  // Test 2: Get all products (public endpoint)
  const productsRes = http.get(`${BASE_URL}/api/products`);
  check(productsRes, {
    'products status is 200': (r) => r.status === 200,
    'products response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(productsRes.status !== 200);

  sleep(1);

  // Test 3: Geocoding (public endpoint)
  const locationRes = http.get(`${BASE_URL}/api/location/provinces`);
  check(locationRes, {
    'location status is 200': (r) => r.status === 200,
  });
  errorRate.add(locationRes.status !== 200);

  sleep(1);

  // Test 4: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check is 200': (r) => r.status === 200,
  });

  sleep(2);
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

**Chạy test:**
```bash
k6 run api-gateway-load-test.js

# Với biến môi trường
API_GATEWAY_URL=https://your-api-gateway.com k6 run api-gateway-load-test.js
```

**Metrics cần theo dõi:**
- `http_req_duration`: Request duration (p95, p99)
- `http_req_failed`: Failed request rate
- `http_reqs`: Request rate (RPS)
- `proxy_latency`: Proxy overhead
- `vus`: Virtual users
- `iteration_duration`: Iteration time

---

### 2. User Service - Authentication Load Testing

**Mục tiêu:**
- Test login throughput
- Test registration throughput
- Test concurrent token verifications
- Test database connection pool

**Test Script: `user-service-auth-test.js`**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.API_GATEWAY_URL || 'https://api-gateway-service-production-04a1.up.railway.app';

// Shared test data
const testUsers = new SharedArray('test users', function () {
  const users = [];
  for (let i = 0; i < 100; i++) {
    users.push({
      email: `testuser${i}@example.com`,
      password: 'Test@123456',
      name: `Test User ${i}`,
      phone: `090${i.toString().padStart(7, '0')}`,
    });
  }
  return users;
});

export const options = {
  scenarios: {
    // Scenario 1: Register users
    register: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'registerUser',
    },
    
    // Scenario 2: Login users
    login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 30 },
        { duration: '2m', target: 30 },
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'loginUser',
      startTime: '2m', // Start after registration
    },
    
    // Scenario 3: Get profile (authenticated requests)
    getProfile: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
      exec: 'getProfile',
      startTime: '3m', // Start after login
    },
  },
  thresholds: {
    'http_req_duration{scenario:register}': ['p(95)<1000'],
    'http_req_duration{scenario:login}': ['p(95)<800'],
    'http_req_duration{scenario:getProfile}': ['p(95)<500'],
    'http_req_failed': ['rate<0.02'], // 2% error rate
  },
};

// Global variables to store tokens
let tokens = [];

export function registerUser() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  const uniqueEmail = `${randomString(8)}_${user.email}`;
  
  const payload = JSON.stringify({
    email: uniqueEmail,
    password: user.password,
    name: user.name,
    phone: user.phone,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/api/auth/customer/register`, payload, params);
  
  check(res, {
    'register status is 201': (r) => r.status === 201,
    'register has token': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.token !== undefined;
    },
  });

  sleep(1);
}

export function loginUser() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/api/auth/customer/login`, payload, params);
  
  const success = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => {
      const body = JSON.parse(r.body);
      if (body.data && body.data.token) {
        tokens.push(body.data.token);
        return true;
      }
      return false;
    },
  });

  sleep(1);
}

export function getProfile() {
  if (tokens.length === 0) {
    console.log('No tokens available, skipping profile request');
    return;
  }

  const token = tokens[Math.floor(Math.random() * tokens.length)];
  
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const res = http.get(`${BASE_URL}/api/auth/profile`, params);
  
  check(res, {
    'profile status is 200': (r) => r.status === 200,
    'profile has user data': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.user !== undefined;
    },
  });

  sleep(2);
}
```

**Chạy test:**
```bash
k6 run user-service-auth-test.js
```

---

### 3. Restaurant & Product Service - Catalog Load Testing

**Mục tiêu:**
- Test catalog browsing performance
- Test filtering & search
- Test cache effectiveness
- Test database query optimization

**Test Script: `catalog-load-test.js`**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.API_GATEWAY_URL || 'https://api-gateway-service-production-04a1.up.railway.app';

const cacheHitRate = new Rate('cache_hits');

export const options = {
  stages: [
    { duration: '1m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Sustained load
    { duration: '2m', target: 200 },  // Peak load
    { duration: '2m', target: 200 },  // Peak sustained
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'cache_hits': ['rate>0.7'], // Expect 70% cache hit rate after warmup
  },
};

let storeIds = [];
let productIds = [];

export function setup() {
  // Get stores for testing
  const storesRes = http.get(`${BASE_URL}/api/stores`);
  const stores = JSON.parse(storesRes.body).data || [];
  storeIds = stores.map(s => s.id);

  // Get products
  const productsRes = http.get(`${BASE_URL}/api/products`);
  const products = JSON.parse(productsRes.body).data || [];
  productIds = products.map(p => p.id);

  return { storeIds, productIds };
}

export default function (data) {
  // Test 1: Browse stores
  const storesRes = http.get(`${BASE_URL}/api/stores`);
  check(storesRes, {
    'stores list loaded': (r) => r.status === 200,
  });
  
  // Check for cache headers
  if (storesRes.headers['X-Cache'] === 'HIT') {
    cacheHitRate.add(1);
  } else {
    cacheHitRate.add(0);
  }

  sleep(1);

  // Test 2: View specific store
  if (data.storeIds.length > 0) {
    const randomStore = data.storeIds[Math.floor(Math.random() * data.storeIds.length)];
    const storeRes = http.get(`${BASE_URL}/api/stores/${randomStore}`);
    check(storeRes, {
      'store detail loaded': (r) => r.status === 200,
    });
  }

  sleep(1);

  // Test 3: Browse products
  const productsRes = http.get(`${BASE_URL}/api/products`);
  check(productsRes, {
    'products list loaded': (r) => r.status === 200,
  });

  sleep(1);

  // Test 4: Filter products by store
  if (data.storeIds.length > 0) {
    const randomStore = data.storeIds[Math.floor(Math.random() * data.storeIds.length)];
    const filterRes = http.get(`${BASE_URL}/api/products?storeId=${randomStore}`);
    check(filterRes, {
      'filtered products loaded': (r) => r.status === 200,
    });
  }

  sleep(1);

  // Test 5: View product detail
  if (data.productIds.length > 0) {
    const randomProduct = data.productIds[Math.floor(Math.random() * data.productIds.length)];
    const productRes = http.get(`${BASE_URL}/api/products/${randomProduct}`);
    check(productRes, {
      'product detail loaded': (r) => r.status === 200,
    });
  }

  sleep(2);
}
```

---

### 4. Cart Service - Shopping Flow Load Testing

**Mục tiêu:**
- Test cart operations throughput
- Test Redis performance under load
- Test concurrent cart modifications
- Test session management

**Test Script: `cart-service-test.js`**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.API_GATEWAY_URL || 'https://api-gateway-service-production-04a1.up.railway.app';

export const options = {
  scenarios: {
    // Add to cart scenario
    addToCart: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '1m', target: 20 },  // 20 RPS
        { duration: '2m', target: 50 },  // 50 RPS
        { duration: '1m', target: 100 }, // 100 RPS (peak)
        { duration: '1m', target: 0 },
      ],
      exec: 'addToCart',
    },
    
    // Get cart scenario
    getCart: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'getCart',
      startTime: '1m',
    },
    
    // Update cart scenario
    updateCart: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '2m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      exec: 'updateCart',
      startTime: '2m',
    },
  },
  thresholds: {
    'http_req_duration{scenario:addToCart}': ['p(95)<300'],
    'http_req_duration{scenario:getCart}': ['p(95)<200'],
    'http_req_duration{scenario:updateCart}': ['p(95)<300'],
    'http_req_failed': ['rate<0.01'],
  },
};

let authToken = '';
let restaurantId = '';
let productId = '';

export function setup() {
  // Login to get token
  const loginPayload = JSON.stringify({
    email: 'loadtest@example.com',
    password: 'Test@123456',
  });

  const loginRes = http.post(
    `${BASE_URL}/api/auth/customer/login`,
    loginPayload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  const loginData = JSON.parse(loginRes.body);
  authToken = loginData.data?.token || '';

  // Get a restaurant and product
  const storesRes = http.get(`${BASE_URL}/api/stores`);
  const stores = JSON.parse(storesRes.body).data || [];
  if (stores.length > 0) {
    restaurantId = stores[0].id;
    
    const productsRes = http.get(`${BASE_URL}/api/products?storeId=${restaurantId}`);
    const products = JSON.parse(productsRes.body).data || [];
    if (products.length > 0) {
      productId = products[0].id;
    }
  }

  return { authToken, restaurantId, productId };
}

export function addToCart(data) {
  const payload = JSON.stringify({
    restaurantId: data.restaurantId,
    productId: data.productId,
    quantity: Math.floor(Math.random() * 3) + 1, // 1-3 items
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.authToken}`,
    },
  };

  const res = http.post(`${BASE_URL}/api/cart/add`, payload, params);
  
  check(res, {
    'add to cart success': (r) => r.status === 200 || r.status === 201,
    'add to cart response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(1);
}

export function getCart(data) {
  const params = {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
    },
  };

  const res = http.get(`${BASE_URL}/api/cart/${data.restaurantId}`, params);
  
  check(res, {
    'get cart success': (r) => r.status === 200,
    'get cart response time < 200ms': (r) => r.timings.duration < 200,
    'cart has items': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.items !== undefined;
    },
  });

  sleep(2);
}

export function updateCart(data) {
  const payload = JSON.stringify({
    quantity: Math.floor(Math.random() * 5) + 1,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.authToken}`,
    },
  };

  const res = http.put(
    `${BASE_URL}/api/cart/${data.restaurantId}/${data.productId}`,
    payload,
    params
  );
  
  check(res, {
    'update cart success': (r) => r.status === 200,
  });

  sleep(1);
}
```

---

### 5. Order & Payment Service - Transaction Flow Load Testing

**Mục tiêu:**
- Test end-to-end order flow
- Test payment processing throughput
- Test Kafka event handling under load
- Test Redis session management

**Test Script: `order-payment-flow-test.js`**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.API_GATEWAY_URL || 'https://api-gateway-service-production-04a1.up.railway.app';

// Custom metrics
const ordersCreated = new Counter('orders_created');
const ordersFailed = new Counter('orders_failed');
const orderProcessingTime = new Trend('order_processing_time');

export const options = {
  scenarios: {
    // Create orders from cart
    createOrders: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '1m', target: 10 },  // 10 orders/sec
        { duration: '3m', target: 20 },  // 20 orders/sec
        { duration: '2m', target: 30 },  // 30 orders/sec (peak)
        { duration: '1m', target: 10 },  // Back down
        { duration: '1m', target: 0 },
      ],
      exec: 'createOrder',
    },
    
    // Check order status
    checkStatus: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '8m',
      preAllocatedVUs: 10,
      maxVUs: 30,
      exec: 'checkOrderStatus',
      startTime: '1m',
    },
  },
  thresholds: {
    'http_req_duration{scenario:createOrders}': ['p(95)<2000'], // 2s for order creation
    'http_req_duration{scenario:checkStatus}': ['p(95)<500'],
    'http_req_failed': ['rate<0.05'],
    'order_processing_time': ['p(95)<3000'], // Full order process < 3s
  },
};

let authToken = '';
let orderIds = [];

export function setup() {
  // Login
  const loginPayload = JSON.stringify({
    email: 'loadtest@example.com',
    password: 'Test@123456',
  });

  const loginRes = http.post(
    `${BASE_URL}/api/auth/customer/login`,
    loginPayload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  authToken = JSON.parse(loginRes.body).data?.token || '';

  return { authToken };
}

export function createOrder(data) {
  const startTime = Date.now();
  
  // First, add items to cart
  const cartPayload = JSON.stringify({
    restaurantId: 'some-restaurant-id',
    productId: 'some-product-id',
    quantity: 2,
  });

  const cartParams = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.authToken}`,
    },
  };

  http.post(`${BASE_URL}/api/cart/add`, cartPayload, cartParams);
  
  sleep(0.5);

  // Then create order from cart
  const orderPayload = JSON.stringify({
    restaurantId: 'some-restaurant-id',
    deliveryAddress: '227 Nguyễn Văn Cừ, Quận 5, TP.HCM',
    contactPhone: '0901234567',
  });

  const orderRes = http.post(
    `${BASE_URL}/api/order/create-from-cart`,
    orderPayload,
    cartParams
  );
  
  const success = check(orderRes, {
    'order created': (r) => r.status === 201 || r.status === 200,
    'order has payment URL': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.paymentUrl !== undefined;
    },
  });

  if (success) {
    ordersCreated.add(1);
    const body = JSON.parse(orderRes.body);
    if (body.data && body.data.orderId) {
      orderIds.push(body.data.orderId);
    }
    orderProcessingTime.add(Date.now() - startTime);
  } else {
    ordersFailed.add(1);
  }

  sleep(2);
}

export function checkOrderStatus(data) {
  if (orderIds.length === 0) {
    return;
  }

  const orderId = orderIds[Math.floor(Math.random() * orderIds.length)];
  
  const params = {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
    },
  };

  const res = http.get(`${BASE_URL}/api/order/status/${orderId}`, params);
  
  check(res, {
    'order status retrieved': (r) => r.status === 200,
    'order has status': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.status !== undefined;
    },
  });

  sleep(1);
}

export function teardown(data) {
  console.log(`Total orders created: ${ordersCreated.value}`);
  console.log(`Total orders failed: ${ordersFailed.value}`);
  console.log(`Success rate: ${(ordersCreated.value / (ordersCreated.value + ordersFailed.value) * 100).toFixed(2)}%`);
}
```

---

## 🎭 Test Scenarios Types

### 1. Load Testing (Kiểm tra tải bình thường)

**Mục đích:** Xác định hiệu suất hệ thống ở mức tải dự kiến

```javascript
export const options = {
  stages: [
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 0 },    // Ramp down
  ],
};
```

### 2. Stress Testing (Kiểm tra quá tải)

**Mục đích:** Tìm giới hạn của hệ thống

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '5m', target: 300 },
    { duration: '5m', target: 400 },
    { duration: '10m', target: 0 },
  ],
};
```

### 3. Spike Testing (Kiểm tra tăng đột ngột)

**Mục đích:** Test khả năng xử lý traffic spike (flash sales, campaigns)

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 100 },  // Fast ramp-up
    { duration: '1m', target: 100 },   // Stay for a bit
    { duration: '10s', target: 1000 }, // Huge spike!
    { duration: '3m', target: 1000 },  // Sustained spike
    { duration: '10s', target: 100 },  // Fast ramp-down
    { duration: '3m', target: 100 },
    { duration: '10s', target: 0 },
  ],
};
```

### 4. Soak Testing (Kiểm tra độ bền)

**Mục đích:** Phát hiện memory leaks, resource exhaustion

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 50 },     // Ramp up
    { duration: '3h', target: 50 },     // Stay for 3 hours!
    { duration: '2m', target: 0 },      // Ramp down
  ],
};
```

### 5. Breakpoint Testing (Tìm điểm giới hạn)

**Mục đích:** Tìm số lượng VUs tối đa hệ thống có thể handle

```javascript
export const options = {
  executor: 'ramping-arrival-rate',
  startRate: 1,
  timeUnit: '1s',
  preAllocatedVUs: 500,
  maxVUs: 5000,
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '5m', target: 20 },
    // ... keep increasing until system breaks
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
  ],
};
```

---

## 📊 Metrics & Reporting

### Built-in Metrics

k6 tự động thu thập các metrics:

```
✓ http_req_duration.........: avg=145ms p(95)=320ms p(99)=450ms
✓ http_req_failed...........: 2.5% (25 of 1000)
✓ http_reqs.................: 1000 (50/s)
✓ iterations................: 500
✓ vus.......................: 100
✓ vus_max...................: 100
```

### Custom Metrics

```javascript
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

const myCounter = new Counter('my_counter');
const myGauge = new Gauge('my_gauge');
const myRate = new Rate('my_rate');
const myTrend = new Trend('my_trend');

export default function() {
  myCounter.add(1);
  myGauge.add(100);
  myRate.add(true); // or false
  myTrend.add(500); // response time
}
```

### Output to Prometheus

**k6 config:**
```javascript
export const options = {
  // ... other options
};

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}
```

**Run with Prometheus Remote Write:**
```bash
k6 run --out experimental-prometheus-rw \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  script.js
```

### Output to InfluxDB + Grafana

```bash
k6 run --out influxdb=http://localhost:8086/k6 script.js
```

**Grafana Dashboard for k6:**
- Import dashboard ID: 2587 (k6 Load Testing Results)

---

## 🎯 Performance Targets

### API Gateway
- **RPS:** > 500 requests/second
- **Latency (p95):** < 500ms
- **Latency (p99):** < 1000ms
- **Error rate:** < 1%

### User Service (Auth)
- **Login throughput:** > 100 logins/second
- **Registration throughput:** > 50 registrations/second
- **Token verification:** < 50ms (p95)

### Restaurant & Product Service
- **List products:** < 300ms (p95)
- **Product detail:** < 200ms (p95)
- **Cache hit rate:** > 80%

### Cart Service (Redis)
- **Add to cart:** < 100ms (p95)
- **Get cart:** < 50ms (p95)
- **Update cart:** < 100ms (p95)

### Order Service
- **Create order:** < 2000ms (p95)
- **Order throughput:** > 50 orders/second
- **Order status check:** < 300ms (p95)

### Payment Service
- **Payment URL generation:** < 1500ms (p95)
- **Payment processing:** < 3000ms (p95)
- **Payment success rate:** > 95%

---

## 🔧 Best Practices

### 1. Realistic Test Data

```javascript
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

const testData = new SharedArray('test data', function() {
  return papaparse.parse(open('./test-data.csv'), { header: true }).data;
});
```

### 2. Think Time (Sleep)

```javascript
export default function() {
  http.get('https://api.example.com/products');
  sleep(Math.random() * 3 + 2); // Random sleep 2-5s (realistic user behavior)
}
```

### 3. Gradual Ramp-up

```javascript
// ❌ Bad: Instant load
{ duration: '1s', target: 1000 }

// ✅ Good: Gradual ramp-up
{ duration: '5m', target: 1000 }
```

### 4. Use Checks, not Assertions

```javascript
// ✅ Good: Check continues even if failed
check(res, {
  'status is 200': (r) => r.status === 200,
});

// ❌ Bad: Throws error and stops test
if (res.status !== 200) {
  throw new Error('Failed');
}
```

### 5. Proper Thresholds

```javascript
export const options = {
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.05'], // < 5% errors
    'checks': ['rate>0.95'], // > 95% checks pass
  },
};
```

---

## 📁 Project Structure

```
k6-tests/
├── config/
│   ├── dev.json
│   ├── staging.json
│   └── prod.json
├── data/
│   ├── users.csv
│   ├── products.json
│   └── restaurants.json
├── lib/
│   ├── utils.js
│   ├── auth.js
│   └── helpers.js
├── scenarios/
│   ├── api-gateway-load-test.js
│   ├── user-service-auth-test.js
│   ├── catalog-load-test.js
│   ├── cart-service-test.js
│   ├── order-payment-flow-test.js
│   ├── stress-test.js
│   ├── spike-test.js
│   └── soak-test.js
├── results/
│   ├── summary.json
│   └── reports/
└── README.md
```

---

## 🚀 Running Tests in CI/CD

### GitHub Actions Example

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run load test
        env:
          API_GATEWAY_URL: ${{ secrets.API_GATEWAY_URL }}
        run: k6 run --out json=results.json scenarios/api-gateway-load-test.js
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: results.json
```

---

**Tài liệu liên quan:**
- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - Tổng quan dự án
- [MONITORING_GUIDE.md](./MONITORING_GUIDE.md) - Hướng dẫn monitoring
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Hướng dẫn testing

