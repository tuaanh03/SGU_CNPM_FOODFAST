import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ========== CUSTOM METRICS ==========
export let registerTrend = new Trend('register_duration_ms');
export let loginTrend = new Trend('login_duration_ms');
export let verifyTokenTrend = new Trend('verify_token_duration_ms');
export let profileTrend = new Trend('profile_duration_ms');
export let updateProfileTrend = new Trend('update_profile_duration_ms');
export let createAddressTrend = new Trend('create_address_duration_ms');
export let getAddressesTrend = new Trend('get_addresses_duration_ms');
export let geocodeTrend = new Trend('geocode_address_duration_ms');
export let browseNearbyStoresTrend = new Trend('browse_nearby_stores_duration_ms');
export let browseStoresTrend = new Trend('browse_stores_duration_ms');
export let browseMenuTrend = new Trend('browse_menu_duration_ms');
export let addToCartTrend = new Trend('add_to_cart_duration_ms');
export let getCartTrend = new Trend('get_cart_duration_ms');
export let createOrderTrend = new Trend('create_order_duration_ms');
export let getOrderTrend = new Trend('get_order_duration_ms');
export let logoutTrend = new Trend('logout_duration_ms');

export let registerSuccess = new Rate('register_success');
export let loginSuccess = new Rate('login_success');
export let verifyTokenSuccess = new Rate('verify_token_success');
export let profileSuccess = new Rate('profile_success');
export let createAddressSuccess = new Rate('create_address_success');
export let getAddressesSuccess = new Rate('get_addresses_success');
export let geocodeSuccess = new Rate('geocode_success');
export let browseNearbyStoresSuccess = new Rate('browse_nearby_stores_success');
export let browseStoresSuccess = new Rate('browse_stores_success');
export let browseMenuSuccess = new Rate('browse_menu_success');
export let addToCartSuccess = new Rate('add_to_cart_success');
export let getCartSuccess = new Rate('get_cart_success');
export let createOrderSuccess = new Rate('create_order_success');
export let getOrderSuccess = new Rate('get_order_success');
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
        create_address_success: ['rate>0.80'],            // > 80% success (relaxed - depends on geocoding)
        get_addresses_success: ['rate>0.95'],             // > 95% success
        geocode_success: ['rate>0.80'],                   // > 80% success (external API - can be slow/fail)
        browse_nearby_stores_success: ['rate>0.80'],      // > 80% success (depends on data availability)
        browse_stores_success: ['rate>0.95'],             // > 95% success
        browse_menu_success: ['rate>0.80'],               // > 80% success (depends on store data)
        add_to_cart_success: ['rate>0.90'],               // > 90% success
        get_cart_success: ['rate>0.95'],                  // > 95% success
        create_order_success: ['rate>0.85'],              // > 85% success
        get_order_success: ['rate>0.95'],                 // > 95% success
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

// Tạo địa chỉ ngẫu nhiên tại TP.HCM để test
function generateRandomAddress() {
    const streets = [
        'Nguyễn Trãi',
        'Lê Lai',
        'Pasteur',
        'Hai Bà Trưng',
        'Điện Biên Phủ',
        'Võ Văn Tần',
        'Cách Mạng Tháng 8',
        'Lý Thường Kiệt',
        'Nguyễn Thị Minh Khai',
        'Tôn Thất Tùng'
    ];

    const wards = [
        'Phường Bến Thành',
        'Phường Bến Nghé',
        'Phường Nguyễn Thái Bình',
        'Phường Phạm Ngũ Lão',
        'Phường Cầu Ông Lãnh',
        'Phường Tân Định',
        'Phường Đa Kao',
        'Phường Võ Thị Sáu'
    ];

    const districts = [
        { name: 'Quận 1', code: '760' },
        { name: 'Quận 3', code: '769' },
        { name: 'Quận 10', code: '778' },
        { name: 'Bình Thạnh', code: '764' }
    ];

    const houseNumber = Math.floor(Math.random() * 500) + 1;
    const street = streets[Math.floor(Math.random() * streets.length)];
    const ward = wards[Math.floor(Math.random() * wards.length)];
    const district = districts[Math.floor(Math.random() * districts.length)];

    return {
        street: `${houseNumber} ${street}`,
        ward: ward,
        district: district.name,
        districtCode: district.code,
        province: 'Thành phố Hồ Chí Minh',
        provinceCode: '79',
        fullAddress: `${houseNumber} ${street}, ${ward}, ${district.name}, Thành phố Hồ Chí Minh`
    };
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

// 6. Geocode địa chỉ để lấy tọa độ (lat/lng)
function geocodeAddress(address, ward, district, province) {
    const url = `${BASE_URL}/api/locations/geocode`;
    const payload = JSON.stringify({
        address: address,
        ward: ward,
        district: district,
        province: province,
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'geocode_address' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    geocodeTrend.add(duration);

    let coordinates = null;
    const statusOk = check(res, {
        'geocode status 200': (r) => r.status === 200,
    });

    if (statusOk) {
        try {
            const body = res.json();
            if (body && body.data) {
                coordinates = {
                    latitude: body.data.latitude,
                    longitude: body.data.longitude,
                };
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Parse geocode error:`, e);
        }
    }

    const success = statusOk && coordinates !== null;
    geocodeSuccess.add(success);

    return { success, coordinates, response: res };
}

// 7. Tạo địa chỉ mới với tọa độ
function createAddress(token, addressData) {
    const url = `${BASE_URL}/api/addresses`;
    const payload = JSON.stringify(addressData);

    const params = {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'create_address' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    createAddressTrend.add(duration);

    let addressId = null;
    const statusOk = check(res, {
        'create address status 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    if (statusOk) {
        try {
            const body = res.json();
            if (body && body.data) {
                addressId = body.data.id || body.data.addressId;
            } else if (body && body.id) {
                addressId = body.id;
            } else if (body && body.addressId) {
                addressId = body.addressId;
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Parse create address response error:`, e);
        }
    } else {
        // Log error for debugging
        console.error(`[VU ${__VU}] Create address failed with status ${res.status}: ${res.body}`);
    }

    // Success nếu status OK, không cần bắt buộc addressId
    const success = statusOk;
    createAddressSuccess.add(success);

    return { success, addressId, response: res };
}

// 8. Lấy danh sách địa chỉ của user
function getAddresses(token) {
    const url = `${BASE_URL}/api/addresses`;

    const params = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'get_addresses' },
    };

    const start = Date.now();
    const res = http.get(url, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    getAddressesTrend.add(duration);

    let addresses = [];
    const statusOk = check(res, {
        'get addresses status 200': (r) => r.status === 200,
    });

    if (statusOk) {
        try {
            const body = res.json();
            if (body && Array.isArray(body.data)) {
                addresses = body.data;
            } else if (body && Array.isArray(body)) {
                addresses = body;
            }
        } catch (e) {
            // ignore
        }
    }

    const success = statusOk;
    getAddressesSuccess.add(success);

    return { success, addresses, response: res };
}

// 9. Tìm nhà hàng gần user (trong bán kính 10km)
function browseNearbyStores(token, latitude, longitude, radius = 10) {
    const url = `${BASE_URL}/api/stores/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}&limit=50`;

    const params = {
        headers: token ? {
            Authorization: `Bearer ${token}`,
        } : {},
        tags: { name: 'browse_nearby_stores' },
    };

    const start = Date.now();
    const res = http.get(url, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    browseNearbyStoresTrend.add(duration);

    let stores = [];
    const statusOk = check(res, {
        'browse nearby stores status 200': (r) => r.status === 200,
    });

    if (statusOk) {
        try {
            const body = res.json();
            if (body && body.success && Array.isArray(body.data)) {
                stores = body.data;
            } else if (body && Array.isArray(body.data)) {
                stores = body.data;
            } else if (body && Array.isArray(body)) {
                stores = body;
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Parse nearby stores error:`, e);
        }
    } else {
        console.error(`[VU ${__VU}] Browse nearby stores failed with status ${res.status}`);
    }

    // Success chỉ cần statusOk, không bắt buộc phải có stores
    // (vì có thể không có stores trong bán kính 10km)
    const success = statusOk;
    browseNearbyStoresSuccess.add(success);

    return { success, stores, response: res };
}

// 10. Xem danh sách cửa hàng (browse stores)
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

// 11. Xem menu (và có thể kèm store details) của 1 cửa hàng
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
            console.error(`[VU ${__VU}] Parse menu error for store ${id}:`, e);
        }
    } else {
        console.error(`[VU ${__VU}] Browse menu failed with status ${res.status} for store ${id}`);
    }

    products = products.filter((p) => p && (p.id || p.productId || p._id));

    // Success chỉ cần statusOk, không bắt buộc phải có products
    // (vì store có thể không có menu hoặc menu rỗng)
    const success = statusOk;

    browseMenuSuccess.add(success);
    return { success, products, response: res };
}

// 12. Thêm sản phẩm vào giỏ hàng
function addToCart(token, storeId, productId, quantity = 1) {
    const url = `${BASE_URL}/api/cart/items`;
    const payload = JSON.stringify({
        storeId: storeId,
        productId: productId,
        quantity: quantity,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'add_to_cart' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    addToCartTrend.add(duration);

    const success = check(res, {
        'add to cart status 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    addToCartSuccess.add(success);
    return { success, response: res };
}

// 13. Xem giỏ hàng
function getCart(token) {
    const url = `${BASE_URL}/api/cart`;

    const params = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'get_cart' },
    };

    const start = Date.now();
    const res = http.get(url, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    getCartTrend.add(duration);

    let cart = null;
    const statusOk = check(res, {
        'get cart status 200': (r) => r.status === 200,
    });

    if (statusOk) {
        try {
            const body = res.json();
            if (body && body.data) {
                cart = body.data;
            } else if (body && body.cart) {
                cart = body.cart;
            } else {
                cart = body;
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Parse cart error:`, e);
        }
    }

    const success = statusOk;
    getCartSuccess.add(success);

    return { success, cart, response: res };
}

// 14. Tạo đơn hàng từ giỏ hàng
function createOrderFromCart(token, addressId, note = '') {
    const url = `${BASE_URL}/api/order/create-from-cart`;
    const payload = JSON.stringify({
        addressId: addressId,
        note: note,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'create_order' },
    };

    const start = Date.now();
    const res = http.post(url, payload, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    createOrderTrend.add(duration);

    let orderId = null;
    const statusOk = check(res, {
        'create order status 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    if (statusOk) {
        try {
            const body = res.json();
            if (body && body.data && body.data.orderId) {
                orderId = body.data.orderId;
            } else if (body && body.orderId) {
                orderId = body.orderId;
            } else if (body && body.data && body.data.id) {
                orderId = body.data.id;
            } else if (body && body.id) {
                orderId = body.id;
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Parse create order response error:`, e);
        }
    } else {
        console.error(`[VU ${__VU}] Create order failed with status ${res.status}: ${res.body}`);
    }

    const success = statusOk && orderId !== null;
    createOrderSuccess.add(success);

    return { success, orderId, response: res };
}

// 15. Xem chi tiết đơn hàng
function getOrder(token, orderId) {
    const url = `${BASE_URL}/api/order/${orderId}`;

    const params = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        tags: { name: 'get_order' },
    };

    const start = Date.now();
    const res = http.get(url, params);
    const duration = Date.now() - start;

    totalRequests.add(1);
    getOrderTrend.add(duration);

    let order = null;
    const statusOk = check(res, {
        'get order status 200': (r) => r.status === 200,
    });

    if (statusOk) {
        try {
            const body = res.json();
            if (body && body.data) {
                order = body.data;
            } else if (body && body.order) {
                order = body.order;
            } else {
                order = body;
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Parse order error:`, e);
        }
    }

    const success = statusOk;
    getOrderSuccess.add(success);

    return { success, order, response: res };
}

// 16. Logout
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
    group('Customer Journey: Register -> Login -> Verify -> Profile -> Address -> Geocode -> Nearby Stores -> Browse Menu -> Create Order -> (Update Profile) -> (Logout)', function () {
        const userEmail = generateUniqueEmail();
        const userName = generateRandomName();
        let userToken = null;
        let userCoordinates = null;

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

        // 5. Tạo địa chỉ mới (70% users)
        const shouldCreateAddress = Math.random() < 0.7;
        if (shouldCreateAddress) {
            group('5. Create Address with Geocoding', function () {
                const addressData = generateRandomAddress();
                console.log(`[VU ${__VU}] Tạo địa chỉ: ${addressData.fullAddress}`);

                // 5a. Geocode địa chỉ để lấy tọa độ
                const geocodeResult = geocodeAddress(
                    addressData.street,
                    addressData.ward,
                    addressData.district,
                    addressData.province
                );

                // Nếu geocode thành công, dùng tọa độ thật
                if (geocodeResult.success && geocodeResult.coordinates) {
                    userCoordinates = geocodeResult.coordinates;
                    console.log(`[VU ${__VU}] Geocode thành công: lat=${userCoordinates.latitude}, lng=${userCoordinates.longitude}`);
                } else {
                    // Fallback: dùng tọa độ trung tâm TP.HCM nếu geocode fail
                    console.warn(`[VU ${__VU}] Geocode thất bại, dùng tọa độ mặc định TP.HCM`);
                    userCoordinates = {
                        latitude: 10.762622,   // Trung tâm Q1, TP.HCM
                        longitude: 106.660172
                    };
                }

                thinkTime(0.5, 1);

                // 5b. Tạo địa chỉ với tọa độ (thật hoặc fallback)
                const createAddressPayload = {
                    name: userName,  // Tên người nhận
                    phone: '0966770047',  // Phone mặc định cho test
                    address: addressData.street,  // Backend expects 'address', not 'street'
                    ward: addressData.ward,
                    district: addressData.district,
                    province: addressData.province,
                    latitude: userCoordinates.latitude,
                    longitude: userCoordinates.longitude,
                    isDefault: true,
                };

                const createResult = createAddress(userToken, createAddressPayload);

                if (!createResult.success) {
                    console.error(`[VU ${__VU}] Tạo địa chỉ thất bại`);
                } else {
                    console.log(`[VU ${__VU}] Tạo địa chỉ thành công, ID: ${createResult.addressId || 'N/A'}`);
                }

                thinkTime(1, 2);
            });

            // 6. Xem danh sách địa chỉ
            group('6. Get Addresses', function () {
                console.log(`[VU ${__VU}] Lấy danh sách địa chỉ`);

                const getAddressResult = getAddresses(userToken);

                if (!getAddressResult.success) {
                    console.error(`[VU ${__VU}] Lấy địa chỉ thất bại`);
                } else {
                    console.log(`[VU ${__VU}] Tìm thấy ${getAddressResult.addresses.length} địa chỉ`);
                }

                thinkTime(1, 2);
            });
        }

        // 7. Browse nearby stores (nếu có tọa độ)
        if (userCoordinates) {
            group('7. Browse Nearby Stores (within 10km)', function () {
                console.log(`[VU ${__VU}] Tìm nhà hàng gần: lat=${userCoordinates.latitude}, lng=${userCoordinates.longitude}`);

                const nearbyResult = browseNearbyStores(
                    userToken,
                    userCoordinates.latitude,
                    userCoordinates.longitude,
                    10 // 10km radius
                );

                if (!nearbyResult.success) {
                    console.error(`[VU ${__VU}] Tìm nhà hàng gần thất bại`);
                } else {
                    console.log(`[VU ${__VU}] Tìm thấy ${nearbyResult.stores.length} nhà hàng gần`);

                    // 7a. Xem menu của 1-2 nhà hàng gần nhất
                    if (nearbyResult.stores.length > 0) {
                        const numStoresToView = Math.min(
                            Math.floor(Math.random() * 2) + 1, // 1-2 stores
                            nearbyResult.stores.length
                        );

                        for (let i = 0; i < numStoresToView; i++) {
                            const store = nearbyResult.stores[i]; // Lấy nhà hàng gần nhất
                            const storeId = store.id || store.storeId || store._id;
                            const distance = store.distance || 0;

                            if (!storeId) continue;

                            console.log(`[VU ${__VU}] Xem menu nhà hàng gần thứ ${i + 1}: ${storeId} (${distance.toFixed(2)} km)`);

                            const menuResult = browseMenu(userToken, storeId);
                            if (!menuResult.success) {
                                console.error(`[VU ${__VU}] Xem menu thất bại`);
                            }

                            thinkTime(3, 8);
                        }
                    }
                }

                thinkTime(2, 5);
            });
        } else {
            // 8. Browse all stores (nếu không có tọa độ)
            group('8. Browse All Stores/Restaurants', function () {
                console.log(`[VU ${__VU}] Duyệt danh sách tất cả cửa hàng`);

                const browseResult = browseStores(userToken);

                if (!browseResult.success) {
                    console.error(`[VU ${__VU}] Browse stores thất bại`);
                    thinkTime(2, 4);
                    return;
                }

                console.log(`[VU ${__VU}] Tìm thấy ${browseResult.stores.length} cửa hàng`);

                thinkTime(2, 5);

                // 8a. Xem menu của 2–3 cửa hàng ngẫu nhiên
                if (browseResult.stores.length > 0) {
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
                            console.error(`[VU ${__VU}] Xem menu cửa hàng thất bại`);
                        }

                        thinkTime(3, 8);
                    }
                }
            });
        }

        // 9. Tạo đơn hàng (50% users)
        const shouldCreateOrder = Math.random() < 0.5;
        if (shouldCreateOrder && userCoordinates) {
            group('9. Create Order Flow (Add to Cart -> View Cart -> Create Order)', function () {
                // 9a. Browse nearby stores để lấy storeId và products
                console.log(`[VU ${__VU}] Bắt đầu quy trình tạo đơn hàng`);

                const nearbyResult = browseNearbyStores(
                    userToken,
                    userCoordinates.latitude,
                    userCoordinates.longitude,
                    10
                );

                if (!nearbyResult.success || nearbyResult.stores.length === 0) {
                    console.error(`[VU ${__VU}] Không tìm thấy nhà hàng gần để tạo đơn`);
                    return;
                }

                // Chọn nhà hàng gần nhất
                const selectedStore = nearbyResult.stores[0];
                const storeId = selectedStore.id || selectedStore.storeId || selectedStore._id;

                console.log(`[VU ${__VU}] Chọn nhà hàng: ${storeId}`);
                thinkTime(1, 2);

                // 9b. Xem menu để lấy products
                const menuResult = browseMenu(userToken, storeId);

                if (!menuResult.success || menuResult.products.length === 0) {
                    console.error(`[VU ${__VU}] Không có sản phẩm trong menu`);
                    return;
                }

                console.log(`[VU ${__VU}] Tìm thấy ${menuResult.products.length} sản phẩm`);
                thinkTime(2, 4);

                // 9c. Thêm 1-3 sản phẩm vào giỏ hàng
                const numProductsToAdd = Math.min(
                    Math.floor(Math.random() * 3) + 1, // 1-3 products
                    menuResult.products.length
                );

                for (let i = 0; i < numProductsToAdd; i++) {
                    const product = menuResult.products[i];
                    const productId = product.id || product.productId || product._id;
                    const quantity = Math.floor(Math.random() * 2) + 1; // 1-2 quantity

                    console.log(`[VU ${__VU}] Thêm sản phẩm vào giỏ: ${productId} (số lượng: ${quantity})`);

                    const addResult = addToCart(userToken, storeId, productId, quantity);

                    if (!addResult.success) {
                        console.error(`[VU ${__VU}] Thêm vào giỏ hàng thất bại`);
                    }

                    thinkTime(1, 2);
                }

                // 9d. Xem giỏ hàng
                console.log(`[VU ${__VU}] Xem giỏ hàng`);

                const cartResult = getCart(userToken);

                if (!cartResult.success) {
                    console.error(`[VU ${__VU}] Xem giỏ hàng thất bại`);
                    return;
                }

                thinkTime(2, 3);

                // 9e. Lấy addressId từ addresses đã tạo
                const addressResult = getAddresses(userToken);
                let addressId = null;

                if (addressResult.success && addressResult.addresses.length > 0) {
                    // Chọn địa chỉ mặc định hoặc địa chỉ đầu tiên
                    const defaultAddress = addressResult.addresses.find(addr => addr.isDefault);
                    addressId = defaultAddress
                        ? (defaultAddress.id || defaultAddress.addressId)
                        : (addressResult.addresses[0].id || addressResult.addresses[0].addressId);
                }

                if (!addressId) {
                    console.error(`[VU ${__VU}] Không có địa chỉ để tạo đơn hàng`);
                    return;
                }

                console.log(`[VU ${__VU}] Sử dụng địa chỉ: ${addressId}`);
                thinkTime(1, 2);

                // 9f. Tạo đơn hàng từ giỏ hàng
                const orderNote = `Load test order from VU ${__VU}`;
                console.log(`[VU ${__VU}] Tạo đơn hàng với địa chỉ: ${addressId}`);

                const orderResult = createOrderFromCart(userToken, addressId, orderNote);

                if (!orderResult.success || !orderResult.orderId) {
                    console.error(`[VU ${__VU}] Tạo đơn hàng thất bại`);
                    return;
                }

                console.log(`[VU ${__VU}] Tạo đơn hàng thành công: ${orderResult.orderId}`);
                thinkTime(2, 3);

                // 9g. Xem chi tiết đơn hàng vừa tạo
                console.log(`[VU ${__VU}] Xem chi tiết đơn hàng: ${orderResult.orderId}`);

                const getOrderResult = getOrder(userToken, orderResult.orderId);

                if (!getOrderResult.success) {
                    console.error(`[VU ${__VU}] Xem chi tiết đơn hàng thất bại`);
                } else {
                    console.log(`[VU ${__VU}] Đơn hàng đã được tạo thành công`);
                }

                thinkTime(2, 4);
            });
        }

        // 10. Update profile (30% users)
        const shouldUpdateProfile = Math.random() < 0.3;
        if (shouldUpdateProfile) {
            group('10. Update Profile', function () {
                const newName = `${userName} (Updated)`;
                console.log(`[VU ${__VU}] Cập nhật profile với tên mới: ${newName}`);

                const updateResult = updateProfile(userToken, newName);

                if (!updateResult.success) {
                    console.error(`[VU ${__VU}] Cập nhật profile thất bại`);
                }

                thinkTime(1, 2);
            });
        }

        // 11. Logout (50% users)
        const shouldLogout = Math.random() < 0.5;
        if (shouldLogout) {
            group('11. Logout', function () {
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
