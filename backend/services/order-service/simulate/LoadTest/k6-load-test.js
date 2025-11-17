import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ========== CUSTOM METRICS ==========
export let loginTrend = new Trend('login_duration_ms');
export let browseTrend = new Trend('browse_duration_ms');
export let addToCartTrend = new Trend('add_to_cart_duration_ms');
export let checkoutTrend = new Trend('checkout_duration_ms');

export let loginSuccess = new Rate('login_success');
export let orderSuccess = new Rate('order_success');

// ========== CONFIG ==========
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const USER_EMAIL = __ENV.K6_USER_EMAIL || 'loaduser@example.com';
const USER_PASS = __ENV.K6_USER_PASS || 'password';

// Dùng chung cho restaurant (menu + cart)
const RESTAURANT_ID =
    __ENV.K6_RESTAURANT_ID ||
    __ENV.K6_STORE_ID || // backward-compatible nếu bạn từng set biến này
    '539960cc-8d53-49ff-9be0-b5a493d78f65';

// Giá trị fallback nếu không lấy được từ API menu
const FALLBACK_PRODUCTS = [
    { id: 'prod-1', name: 'Fallback 1', price: 10000, image: '' },
    { id: 'prod-2', name: 'Fallback 2', price: 15000, image: '' },
    { id: 'prod-3', name: 'Fallback 3', price: 20000, image: '' },
];

// Test Options
export let options = {
    stages: [
        { duration: '2m', target: 100 },   // warm up
        { duration: '5m', target: 500 },   // ramp up
        { duration: '8m', target: 1000 },  // reach peak
        { duration: '10m', target: 1000 }, // sustain
        { duration: '5m', target: 0 },     // ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        login_success: ['rate>0.95'],
        order_success: ['rate>0.90'],
    },
};

// ========== UTIL ==========
function randomThink(minSec = 1, maxSec = 3) {
    sleep(Math.random() * (maxSec - minSec) + minSec);
}

// Per-VU storage
let VU_EMAIL = null;
let VU_TOKEN = null;

// ========== HELPERS ==========

// Login, trả về token hoặc null
function doLogin(emailToUse) {
    const url = `${BASE_URL}/api/auth/customer/login`;
    const payload = JSON.stringify({ email: emailToUse, password: USER_PASS });
    const params = {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;
    loginTrend.add(duration);

    const ok = check(res, {
        'login status 200': (r) => r.status === 200,
    });

    let token = null;
    if (ok) {
        try {
            const dataToken =
                res.json('data.token') ||
                res.json('token') ||
                res.json('accessToken') ||
                res.json('access_token');
            if (dataToken) {
                token = dataToken;
            }
        } catch (e) {
            // ignore
        }
    }

    loginSuccess.add(!!token);
    return token;
}

// Lấy menu: trả về danh sách object sản phẩm {id, name, price, image}
function browseMenu(authHeader) {
    const url = `${BASE_URL}/api/restaurants/${RESTAURANT_ID}/menu`;
    const params = {
        headers: { Authorization: `Bearer ${authHeader}` },
        tags: { name: 'browse_menu' },
    };

    const start = Date.now();
    const res = http.get(url, params);
    const duration = Date.now() - start;
    browseTrend.add(duration);

    check(res, {
        'browse status 200': (r) => r.status === 200,
    });

    let products = [];

    try {
        const body = res.json();

        // Case 1: body.data.products.products (nested)
        if (
            body &&
            body.data &&
            body.data.products &&
            body.data.products.products &&
            Array.isArray(body.data.products.products)
        ) {
            const arr = body.data.products.products;
            for (let i = 0; i < arr.length; i++) {
                const p = arr[i];
                if (!p) continue;
                products.push({
                    id: p.id || p.productId || p._id,
                    name: p.name || p.productName || 'Unknown',
                    price: p.price || p.productPrice || 0,
                    image: p.image || p.productImage || '',
                });
            }
        }
        // Case 2: body.data.products (flat array)
        else if (body && body.data && Array.isArray(body.data.products)) {
            const arr = body.data.products;
            for (let i = 0; i < arr.length; i++) {
                const p = arr[i];
                if (!p) continue;
                products.push({
                    id: p.id || p.productId || p._id,
                    name: p.name || p.productName || 'Unknown',
                    price: p.price || p.productPrice || 0,
                    image: p.image || p.productImage || '',
                });
            }
        }
    } catch (e) {
        // ignore parse error, sẽ dùng fallback
    }

    // Lọc bỏ sản phẩm không có id
    products = products.filter((p) => p.id);

    if (products.length === 0) {
        return FALLBACK_PRODUCTS;
    }

    return products;
}

// Add to cart: gửi body đúng cấu trúc API yêu cầu
function addToCart(authHeader, product, qty = 1) {
    const url = `${BASE_URL}/api/cart/add`;

    const payload = JSON.stringify({
        restaurantId: RESTAURANT_ID,
        productId: product.id,
        quantity: qty,
        productName: product.name,
        productPrice: product.price,
        productImage: product.image,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authHeader}`,
        },
        tags: { name: 'add_to_cart' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;
    addToCartTrend.add(duration);

    check(res, {
        'add to cart status 200|201': (r) => r.status === 200 || r.status === 201,
    });

    return res;
}

function createOrder(authHeader) {
    const url = `${BASE_URL}/api/order/create-from-cart`;

    const payload = JSON.stringify({
        storeId: RESTAURANT_ID,
        deliveryAddress: __ENV.K6_DELIVERY_ADDRESS || "123 Main St, City",
        contactPhone: __ENV.K6_CONTACT_PHONE || "0901234567",
        note: __ENV.K6_ORDER_NOTE || "Ghi chú (optional)",
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authHeader}`,
        },
        tags: { name: 'create_order' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;
    checkoutTrend.add(duration);

    const ok = check(res, {
        'create order status 201|200': (r) => r.status === 200 || r.status === 201,
    });

    orderSuccess.add(ok);
    return res;
}


// ========== VU FLOW ==========

export default function () {
    group('VU flow: register/login -> browse -> add 3 products -> checkout', function () {
        // Đăng ký / login lần đầu cho mỗi VU
        if (!VU_TOKEN && __ITER === 0) {
            // Gen email unique cho VU
            try {
                const parts = (USER_EMAIL || 'loaduser@example.com').split('@');
                const local = parts[0] || 'loaduser';
                const domain = parts[1] || 'example.com';
                VU_EMAIL = `${local}+vu${__VU}@${domain}`;
            } catch (e) {
                VU_EMAIL = `loaduser+vu${__VU}@example.com`;
            }

            // Đăng ký
            const registerRes = http.post(
                `${BASE_URL}/api/auth/customer/register`,
                JSON.stringify({
                    email: VU_EMAIL,
                    password: USER_PASS,
                    name: 'Load Tester',
                }),
                {
                    headers: { 'Content-Type': 'application/json' },
                    tags: { name: 'register' },
                }
            );

            const registerOk = check(registerRes, {
                'register status 200|201': (r) => r.status === 200 || r.status === 201,
            });

            if (!registerOk) {
                // Nếu đăng ký fail (vd: đã tồn tại), thử login luôn
                let token = doLogin(VU_EMAIL);
                if (!token && __ENV.K6_ALLOW_SHARED_LOGIN === 'true') {
                    token = doLogin(USER_EMAIL);
                }
                VU_TOKEN = token;
            } else {
                // Register OK → login
                sleep(0.2);
                VU_TOKEN = doLogin(VU_EMAIL);
            }
        }

        // Nếu vẫn không có token thì nghỉ vòng này
        if (!VU_TOKEN) {
            sleep(1);
            return;
        }

        // Think time nhẹ
        randomThink(0.5, 2);

        // 1) Browse menu
        const products = browseMenu(VU_TOKEN);
        randomThink(0.2, 1);

        // 2) Add 3 products (random từ menu)
        for (let i = 0; i < 3; i++) {
            const randomIndex = Math.floor(Math.random() * products.length);
            const product = products[randomIndex];
            addToCart(VU_TOKEN, product, 1);
            randomThink(0.1, 0.5);
        }

        // 3) Checkout
        createOrder(VU_TOKEN);

        // End of iteration think
        sleep(Math.random() * 4 + 1);
    });
}
