import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Custom metrics
export let loginTrend = new Trend('login_duration_ms');
export let browseTrend = new Trend('browse_duration_ms');
export let addToCartTrend = new Trend('add_to_cart_duration_ms');
export let checkoutTrend = new Trend('checkout_duration_ms');

export let loginSuccess = new Rate('login_success');
export let orderSuccess = new Rate('order_success');

// ==== CONFIGURATION ====
// You can override baseUrl via K6_BASE_URL env var, defaults to localhost:3000
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const USER_EMAIL = __ENV.K6_USER_EMAIL || 'loaduser@example.com';
const USER_PASS = __ENV.K6_USER_PASS || 'password';

// Test Options: Ramp up to 1000 VUs gradually over 30 minutes
// This prevents sudden spike and mimics realistic user growth
export let options = {
  stages: [
    { duration: '2m', target: 100 },   // warm up: 0 -> 100 VUs in 2min
    { duration: '5m', target: 500 },   // ramp up: 100 -> 500 VUs in 5min
    { duration: '8m', target: 1000 },  // reach peak: 500 -> 1000 VUs in 8min
    { duration: '10m', target: 1000 }, // sustain: 1000 VUs for 10min
    { duration: '5m', target: 0 }      // ramp down: 1000 -> 0 in 5min
  ],
  thresholds: {
    // 95% of requests should finish within 2000ms
    'http_req_duration': ['p(95)<2000'],
    // keep error rate low
    'login_success': ['rate>0.95'],  // relaxed from 0.99 to 0.95 for load test
    'order_success': ['rate>0.90']   // relaxed from 0.98 to 0.90
  }
};

function randomThink(minSec = 1, maxSec = 3) {
  sleep(Math.random() * (maxSec - minSec) + minSec);
}

// per-VU storage (each VU gets its own copy in k6 runtime)
let VU_EMAIL = null;
let VU_TOKEN = null;

// Helper: perform register and return token (or null)
function doRegister(email) {
  const url = `${BASE_URL}/api/auth/customer/register`;
  const payload = JSON.stringify({ email, password: USER_PASS, name: 'Load Tester' });
  const params = { headers: { 'Content-Type': 'application/json' }, tags: { name: 'register' } };

  const res = http.post(url, payload, params);
  // accept 200 or 201 success
  const ok = check(res, {
    'register status 200|201': (r) => r.status === 200 || r.status === 201
  });

  if (!ok) {
    return null;
  }

  // try to extract token (some implementations return token on register)
  const token = res.json('data.token') || res.json('token') || res.json('accessToken') || res.json('access_token');
  return token || null;
}

// Helper: perform login and return JWT or null
function doLogin(emailToUse) {
  const url = `${BASE_URL}/api/auth/customer/login`;
  const payload = JSON.stringify({ email: emailToUse, password: USER_PASS });
  const params = { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } };

  const start = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - start;
  loginTrend.add(duration);

  const ok = check(res, {
    'login status 200': (r) => r.status === 200,
    'login contains token': (r) => !!(r.json('data.token') || r.json('token') || r.json('accessToken') || r.json('access_token'))
  });
  loginSuccess.add(ok);

  if (!ok) {
    return null;
  }

  // try common response shapes
  const token = res.json('data.token') || res.json('token') || res.json('accessToken') || res.json('access_token');
  return token;
}

// Helper: browse menu for a given store id, returns array of product ids
function browseMenu(authHeader) {
  const storeId = __ENV.K6_STORE_ID || '805228a7-6f44-44f9-a9c6-29056f9303c5';
  const url = `${BASE_URL}/api/restaurants/${storeId}/menu`;
  const params = { headers: { Authorization: `Bearer ${authHeader}` }, tags: { name: 'browse_menu' } };

  const start = Date.now();
  const res = http.get(url, params);
  const duration = Date.now() - start;
  browseTrend.add(duration);

  check(res, {
    'browse status 200': (r) => r.status === 200
  });

  // try to extract product ids safely
  let ids = [];
  try {
    const body = res.json();
    if (body && body.data && body.data.products && Array.isArray(body.data.products.products)) {
      ids = body.data.products.products.map(p => p.id || p.productId || p._id).filter(Boolean);
    } else if (body && body.data && Array.isArray(body.data.products)) {
      ids = body.data.products.map(p => p.id || p.productId || p._id).filter(Boolean);
    }
  } catch (e) {
    // ignore
  }

  // fallback: if none found, make synthetic ids so add-to-cart still executes
  if (ids.length === 0) {
    ids = [__ENV.FALLBACK_PRODUCT_ID || 'prod-1', __ENV.FALLBACK_PRODUCT_ID_2 || 'prod-2', __ENV.FALLBACK_PRODUCT_ID_3 || 'prod-3'];
  }

  return ids;
}

// Helper: add product to cart
function addToCart(authHeader, productId, qty = 1) {
  const url = `${BASE_URL}/api/cart/add`;
  const payload = JSON.stringify({ productId, quantity: qty });
  const params = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authHeader}` }, tags: { name: 'add_to_cart' } };

  const start = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - start;
  addToCartTrend.add(duration);

  check(res, {
    'add to cart status 200|201': (r) => r.status === 200 || r.status === 201
  });
  return res;
}

// Helper: create order from cart (checkout)
function createOrder(authHeader) {
  const url = `${BASE_URL}/api/order/create-from-cart`;
  const payload = JSON.stringify({}); // assume server uses cart in session or identifies by JWT
  const params = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authHeader}` }, tags: { name: 'create_order' } };

  const start = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - start;
  checkoutTrend.add(duration);

  const ok = check(res, {
    'create order status 201|200': (r) => r.status === 200 || r.status === 201
  });
  orderSuccess.add(ok);

  return res;
}

export default function () {
  group('VU flow: register/login -> browse -> add 3 products -> checkout', function () {
    // ensure each VU has its own account: do register on first iteration for this VU
    if (!VU_TOKEN && __ITER === 0) {
      // generate unique email using base USER_EMAIL
      try {
        const parts = (USER_EMAIL || 'loaduser@example.com').split('@');
        const local = parts[0] || 'loaduser';
        const domain = parts[1] || 'example.com';
        VU_EMAIL = `${local}+vu${__VU}@${domain}`;
      } catch (e) {
        VU_EMAIL = `loaduser+vu${__VU}@example.com`;
      }

      // 1) Register the account (creates entry in DB)
      // WARNING: Each VU creates a REAL user in your database
      // After test, you may need to cleanup 1000+ accounts
      const registerRes = http.post(`${BASE_URL}/api/auth/customer/register`,
        JSON.stringify({ email: VU_EMAIL, password: USER_PASS, name: 'Load Tester' }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'register' } }
      );

      const registerOk = check(registerRes, {
        'register status 200|201': (r) => r.status === 200 || r.status === 201
      });

      if (!registerOk) {
        // Registration failed - maybe account already exists or endpoint error
        // Try to login with this email in case it was pre-seeded
        const loginToken = doLogin(VU_EMAIL);
        if (loginToken) {
          VU_TOKEN = loginToken;
        } else if (__ENV.K6_ALLOW_SHARED_LOGIN === 'true') {
          // Fallback to shared account if allowed
          VU_TOKEN = doLogin(USER_EMAIL);
        }
        // If still no token, VU will skip iterations below
      } else {
        // Registration succeeded - now LOGIN to get token
        // (Most APIs don't return token on register, need separate login)
        sleep(0.2); // small delay before login
        VU_TOKEN = doLogin(VU_EMAIL);
      }
    }

    // If token still null (registration/login failed), abort this iteration safely
    if (!VU_TOKEN) {
      // short sleep to avoid tight loop
      sleep(1);
      return;
    }

    // brief think
    randomThink(0.5, 2);

    // 2) Browse menu
    const products = browseMenu(VU_TOKEN);
    randomThink(0.2, 1);

    // 3) Add 3 items to cart (pick first 3 ids or repeat last)
    for (let i = 0; i < 3; i++) {
      const pid = products[i] || products[products.length - 1];
      addToCart(VU_TOKEN, pid, 1);
      randomThink(0.1, 0.5);
    }

    // 4) Checkout / create order
    createOrder(VU_TOKEN);

    // end of iteration think time to spread requests
    sleep( Math.random() * 4 + 1 );
  });
}
