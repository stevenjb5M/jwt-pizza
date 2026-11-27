import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 20, duration: '30s' };

const SERVICE = 'http://localhost:3000';
const json = { 'Content-Type': 'application/json' };

export function setup() {
  const response = http.put(`${SERVICE}/api/auth`, JSON.stringify({ email: 'a@jwt.com', password: 'admin' }), { headers: json });
  return { token: response.json().token };
}

export default function (data) {
  const headers = { ...json, Authorization: `Bearer ${data.token}` };
  http.get(`${SERVICE}/api/order/menu`, { headers });
  const order = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.0038 }] };
  const response = http.post(`${SERVICE}/api/order`, JSON.stringify(order), { headers });
  check(response, { 'order ok': (r) => r.status === 200 });
}
