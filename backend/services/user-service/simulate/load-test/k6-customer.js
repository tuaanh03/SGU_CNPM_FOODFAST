import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ========== CUSTOM METRICS ==========
export let registerTrend = new Trend('register_duration_ms');
export let loginTrend = new Trend('login_duration_ms');
export let verifyTokenTrend = new Trend('verify_token_duration_ms');
export let profileTrend = new Trend('profile_duration_ms');
export let updateProfileTrend = new Trend('update_profile_duration_ms');
export let browseStoresTrend = new Trend('browse_stores_duration_ms');
export let browseMenuTrend = new Trend('browse_menu_duration_ms');
export let logoutTrend = new Trend('logout_duration_ms');

export let registerSuccess = new Rate('register_success');
export let loginSuccess = new Rate('login_success');
export let verifyTokenSuccess = new Rate('verify_token_success');
export let profileSuccess = new Rate('profile_success');
export let browseStoresSuccess = new Rate('browse_stores_success');
export let browseMenuSuccess = new Rate('browse_menu_success');
export let logoutSuccess = new Rate('logout_success');

export let totalRequests = new Counter('total_requests');

// ========== CONFIG ==========
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const USER_PASSWORD = __ENV.K6_USER_PASS || 'Test@123456';

// Dùng chung cho restaurant (menu + cart)
const RESTAURANT_ID =
    __ENV.K6_RESTAURANT_ID ||
    __ENV.K6_STORE_ID || // backward-compatible nếu bạn từng dùng biến này
    '539960cc-8d53-49ff-9be0-b5a493d78f65';

// Test Options - Giả lập hành vi người dùng thật
export let options = {
    stages: [
        { duration: '30s', target: 10 },  // Warm up: 10 users
        { duration: '1m', target: 50 },   // Ramp up: 50 users
        { duration: '2m', target: 100 },  // Normal load: 100 users
        { duration: '3m', target: 200 },  // Peak load: 200 users
        { duration: '2m', target: 100 },  // Scale down
        { duration: '1m', target: 0 },    // Cool down
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000', 'p(99)<5000'],  // 95% < 3s, 99% < 5s
        http_req_failed: ['rate<0.05'],                   // < 5% failures
        register_success: ['rate>0.90'],                  // > 90% success
        login_success: ['rate>0.95'],                     // > 95% success
        verify_token_success: ['rate>0.95'],              // > 95% success
        profile_success: ['rate>0.95'],                   // > 95% success
        browse_stores_success: ['rate>0.95'],             // > 95% success
    },
};

// ========== UTILITY FUNCTIONS ==========

// Giả lập thời gian suy nghĩ của người dùng thật
function thinkTime(minSec = 1, maxSec = 3) {
    const randomTime = Math.random() * (maxSec - minSec) + minSec;
    sleep(randomTime);
}

// Tạo email ngẫu nhiên cho mỗi VU
function generateUniqueEmail() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `customer${__VU}_${timestamp}_${random}@loadtest.com`;
}

// Tạo tên ngẫu nhiên
function generateRandomName() {
    const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Võ', 'Đặng'];
    const lastNames = ['Văn A', 'Thị B', 'Minh C', 'Hoàng D', 'Thành E', 'Hải F'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
}

// ========== API FUNCTIONS ==========

// 1. Đăng ký khách hàng
function registerCustomer(email, password, name) {
    const url = `${BASE_URL}/api/auth/customer/register`;
    const payload = JSON.stringify({
        email: email,
        password: password,
        name: name,
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'register_customer' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    registerTrend.add(duration);

    const success = check(res, {
        'register status 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    registerSuccess.add(success);
    return { success, response: res };
}

// 2. Đăng nhập
function loginCustomer(email, password) {
    const url = `${BASE_URL}/api/auth/customer/login`;
    const payload = JSON.stringify({
        email: email,
        password: password,
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login_customer' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    loginTrend.add(duration);

    let token = null;

    const successStatus = check(res, {
        'login status 200': (r) => r.status === 200,
    });

    if (successStatus) {
        try {
            token =
                res.json('data.token') ||
                res.json('token') ||
                res.json('accessToken') ||
                res.json('access_token');
        } catch (e) {
            // ignore
        }
    }

    const success = !!token;
    loginSuccess.add(success);

    return { success, token, response: res };
}

// 3. Verify token
function verifyToken(token) {
    const url = `${BASE_URL}/api/auth/verify-token`;
    const payload = JSON.stringify({ token: token });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
        tags: { name: 'verify_token' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    verifyTokenTrend.add(duration);

    const success = check(res, {
        'verify token status 200': (r) => r.status === 200,
        'verify token success': (r) => {
            try {
                const body = r.json();
                return body && (body.success === true || body.valid === true);
            } catch (e) {
                return false;
            }
        },
    });

    verifyTokenSuccess.add(success);
    return { success, response: res };
}

// 4. Lấy thông tin profile
function getProfile(token) {
    const url = `${BASE_URL}/api/auth/profile`;

    const params = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'get_profile' },
    };

    const start = Date.now();
    const res = http.get(url, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    profileTrend.add(duration);

    const success = check(res, {
        'profile status 200': (r) => r.status === 200,
    });

    profileSuccess.add(success);
    return { success, response: res };
}

// 5. Cập nhật profile
function updateProfile(token, name) {
    const url = `${BASE_URL}/api/auth/profile`;
    const payload = JSON.stringify({
        name: name,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'update_profile' },
    };

    const start = Date.now();
    const res = http.put(url, payload, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    updateProfileTrend.add(duration);

    const success = check(res, {
        'update profile status 200': (r) => r.status === 200,
    });

    return { success, response: res };
}

// 6. Xem danh sách cửa hàng (browse stores)
function browseStores(token) {
    const url = `${BASE_URL}/api/stores`;

    const params = {
        headers: token ? {
            Authorization: `Bearer ${token}`,
        } : {},
        tags: { name: 'browse_stores' },
    };

    const start = Date.now();
    const res = http.get(url, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    browseStoresTrend.add(duration);

    let stores = [];
    const statusOk = check(res, {
        'browse stores status 200': (r) => r.status === 200,
    });

    if (statusOk) {
        try {
            const body = res.json();

            // Thử các cấu trúc response khác nhau
            if (body && body.success && Array.isArray(body.data)) {
                stores = body.data;
            } else if (body && Array.isArray(body.data)) {
                stores = body.data;
            } else if (body && body.data && Array.isArray(body.data.stores)) {
                stores = body.data.stores;
            } else if (body && Array.isArray(body.stores)) {
                stores = body.stores;
            } else if (body && Array.isArray(body)) {
                stores = body;
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Parse stores error:`, e);
        }
    }

    const hasData = stores.length > 0;
    const success = statusOk && hasData;
    browseStoresSuccess.add(success);

    return { success, stores, response: res };
}

// 7. Xem menu (và có thể kèm store details) của 1 cửa hàng
function browseMenu(token, storeId) {
    const id = storeId || RESTAURANT_ID;
    const url = `${BASE_URL}/api/restaurants/${id}/menu`; // nếu backend bạn là /api/stores/:id/menus thì đổi ở đây

    const params = {
        headers: { Authorization: `Bearer ${token}` },
        tags: { name: 'browse_menu' },
    };

    const start = Date.now();
    const res = http.get(url, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    browseMenuTrend.add(duration);

    let products = [];
    const statusOk = check(res, {
        'browse menu status 200': (r) => r.status === 200,
    });

    if (statusOk) {
        try {
            const body = res.json();

            // body.data.products.products (nested)
            if (
                body &&
                body.data &&
                body.data.products &&
                body.data.products.products &&
                Array.isArray(body.data.products.products)
            ) {
                products = body.data.products.products;
            }
            // body.data.products (flat array)
            else if (body && body.data && Array.isArray(body.data.products)) {
                products = body.data.products;
            }
            // hoặc nếu API trả products trực tiếp
            else if (body && Array.isArray(body.products)) {
                products = body.products;
            }
        } catch (e) {
            // ignore
        }
    }

    products = products.filter((p) => p && (p.id || p.productId || p._id));
    const hasData = products.length > 0;
    const success = statusOk && hasData;

    browseMenuSuccess.add(success);
    return { success, products, response: res };
}

// 8. Logout
function logoutUser(token) {
    const url = `${BASE_URL}/api/auth/logout`;

    const params = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'logout' },
    };

    const start = Date.now();
    const res = http.post(url, null, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    logoutTrend.add(duration);

    const success = check(res, {
        'logout status 200': (r) => r.status === 200,
    });

    logoutSuccess.add(success);
    return { success, response: res };
}

// ========== MAIN TEST SCENARIO ==========

export default function () {
    group('Customer Journey: Register -> Login -> Verify -> Profile -> Browse Stores -> Store Menu -> (Update Profile) -> (Logout)', function () {
        const userEmail = generateUniqueEmail();
        const userName = generateRandomName();
        let userToken = null;

        // 1. Register
        group('1. Register New Customer', function () {
            console.log(`[VU ${__VU}] Đăng ký tài khoản: ${userEmail}`);

            const registerResult = registerCustomer(userEmail, USER_PASSWORD, userName);

            if (!registerResult.success) {
                console.error(`[VU ${__VU}] Đăng ký thất bại`);
                return;
            }

            thinkTime(1, 3);
        });

        // 2. Login
        group('2. Login Customer', function () {
            console.log(`[VU ${__VU}] Đăng nhập với email: ${userEmail}`);

            const loginResult = loginCustomer(userEmail, USER_PASSWORD);

            if (!loginResult.success || !loginResult.token) {
                console.error(`[VU ${__VU}] Đăng nhập thất bại`);
                return;
            }

            userToken = loginResult.token;
            console.log(`[VU ${__VU}] Đăng nhập thành công, token: ${userToken.substring(0, 20)}...`);

            thinkTime(0.5, 2);
        });

        if (!userToken) {
            console.error(`[VU ${__VU}] Không có token, dừng test`);
            return;
        }

        // 3. Verify token
        group('3. Verify Token', function () {
            console.log(`[VU ${__VU}] Verify token`);

            const verifyResult = verifyToken(userToken);

            if (!verifyResult.success) {
                console.error(`[VU ${__VU}] Verify token thất bại`);
            }

            thinkTime(0.2, 1);
        });

        // 4. Get profile
        group('4. Get Profile', function () {
            console.log(`[VU ${__VU}] Xem thông tin profile`);

            const profileResult = getProfile(userToken);

            if (!profileResult.success) {
                console.error(`[VU ${__VU}] Lấy profile thất bại`);
            }

            thinkTime(1, 3);
        });

        // 5. Browse stores
        group('5. Browse Stores/Restaurants', function () {
            console.log(`[VU ${__VU}] Duyệt danh sách cửa hàng`);

            const browseResult = browseStores(userToken);

            if (!browseResult.success) {
                console.error(`[VU ${__VU}] Browse stores thất bại`);
                thinkTime(2, 4);
                return;
            }

            console.log(`[VU ${__VU}] Tìm thấy ${browseResult.stores.length} cửa hàng`);

            thinkTime(2, 5);

            // 6. Xem menu (và details nếu API trả kèm) của 2–3 cửa hàng
            if (browseResult.stores.length > 0) {
                group('6. View Store Menu (with details)', function () {
                    const numStoresToView = Math.min(
                        Math.floor(Math.random() * 2) + 2, // 2-3 stores
                        browseResult.stores.length
                    );

                    for (let i = 0; i < numStoresToView; i++) {
                        const randomIndex = Math.floor(Math.random() * browseResult.stores.length);
                        const store = browseResult.stores[randomIndex];
                        const storeId = store.id || store.storeId || store._id || RESTAURANT_ID;

                        if (!storeId) continue;

                        console.log(`[VU ${__VU}] Xem menu cửa hàng ${i + 1}: ${storeId}`);

                        const menuResult = browseMenu(userToken, storeId);
                        if (!menuResult.success) {
                            console.error(`[VU ${__VU}] Xem menu cửa hàng thất bại (có thể do chưa có endpoint /menu)`);
                        }

                        thinkTime(3, 8);
                    }
                });
            }
        });

        // 7. Update profile (30% users)
        const shouldUpdateProfile = Math.random() < 0.3;
        if (shouldUpdateProfile) {
            group('7. Update Profile', function () {
                const newName = `${userName} (Updated)`;
                console.log(`[VU ${__VU}] Cập nhật profile với tên mới: ${newName}`);

                const updateResult = updateProfile(userToken, newName);

                if (!updateResult.success) {
                    console.error(`[VU ${__VU}] Cập nhật profile thất bại`);
                }

                thinkTime(1, 2);
            });
        }

        // 8. Logout (50% users)
        const shouldLogout = Math.random() < 0.5;
        if (shouldLogout) {
            group('8. Logout', function () {
                console.log(`[VU ${__VU}] Đăng xuất`);

                const logoutResult = logoutUser(userToken);

                if (!logoutResult.success) {
                    console.error(`[VU ${__VU}] Logout thất bại`);
                }
            });
        }

        thinkTime(2, 5);
    });
}

// ========== SETUP & TEARDOWN ==========

export function setup() {
    console.log('=== K6 Load Test Started ===');
    console.log(`Base URL: ${BASE_URL}`);
    console.log('================================');
}

export function teardown(data) {
    console.log('=== K6 Load Test Completed ===');
    console.log('Check the results above for metrics');
    console.log('===================================');
}
