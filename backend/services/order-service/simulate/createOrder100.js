import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  scenarios: {
    load_test: {
      executor: 'shared-iterations',
      // use a single VU so requests are sequential and can be spaced
      vus: 1,
      iterations: 100,
      // total expected runtime ~ 100 * 2s = 200s + overhead
      maxDuration: '5m',
    },
  },
  thresholds: {
    // optional thresholds to get a quick pass/fail from k6
    // http_req_failed: ['rate<0.2'],
    http_req_duration: ['p(95)<2000'],
  },
};

const TARGET = __ENV.TARGET || 'http://localhost:3000'; // default to api-gateway
// Choose endpoint path depending on whether TARGET points to order-service (direct) or gateway
const isDirectToOrder = TARGET.includes(':2000') || TARGET.includes('order-service');
const ENDPOINT = isDirectToOrder ? `${TARGET}/order/create-from-cart` : `${TARGET}/api/order/create-from-cart`;

// Required fields: storeId (from env or default)
const STORE_ID = __ENV.STORE_ID || 'test-store';
const DELIVERY_ADDRESS = __ENV.DELIVERY_ADDRESS || '123 Test Address';
const CONTACT_PHONE = __ENV.CONTACT_PHONE || '0123456789';
const NOTE = __ENV.NOTE || 'Load test order';

export default function () {
  const payload = JSON.stringify({
    storeId: STORE_ID,
    deliveryAddress: DELIVERY_ADDRESS,
    contactPhone: CONTACT_PHONE,
    note: NOTE,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      // Keep x-user-id to avoid 401 when calling order-service directly
      'x-user-id': '1',
    },
    timeout: '60s',
  };

  // Allow passing Authorization token via ENV (e.g. -e AUTH="Bearer <token>")
  if (typeof __ENV.AUTH !== 'undefined' && __ENV.AUTH) {
    params.headers['Authorization'] = __ENV.AUTH;
  }

  const res = http.post(ENDPOINT, payload, params);

  // Log failed responses to help debug why Prometheus/Grafana don't see expected traffic
  if (res.status >= 400) {
    // print only first 1k chars of body to avoid flooding
    const bodySnippet = typeof res.body === 'string' ? res.body.substring(0, 1000) : JSON.stringify(res.body).substring(0, 1000);
    console.error(`REQUEST FAILED: status=${res.status} url=${ENDPOINT} body=${bodySnippet}`);
  }

  // basic checks so the summary shows success/failure
  check(res, {
    'status < 500': (r) => r.status < 500,
  });

  // space requests by 2 seconds as requested
  sleep(5);
}
