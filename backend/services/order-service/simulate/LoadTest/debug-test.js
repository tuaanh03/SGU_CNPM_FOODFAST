import http from 'k6/http';
import { check } from 'k6';

export default function () {
  console.log('Testing register...');
  const registerRes = http.post('http://localhost:3000/api/auth/customer/register',
    JSON.stringify({ email: `test${__VU}_${__ITER}@example.com`, password: 'password', name: 'Test' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  console.log(`Register status: ${registerRes.status}`);
  console.log(`Register body: ${registerRes.body}`);

  const ok = check(registerRes, {
    'register is 200': (r) => r.status === 200,
    'register is 201': (r) => r.status === 201,
    'register is 200 OR 201': (r) => r.status === 200 || r.status === 201
  });

  console.log(`Checks passed: ${ok}`);
}

