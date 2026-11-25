import { sleep, check, group, fail } from 'k6';
import http from 'k6/http';

export const options = {
  cloud: { distribution: { 'amazon:us:columbus': { loadZone: 'amazon:us:columbus', percent: 100 } } },
  thresholds: {},
  scenarios: {
    Scenario_1: {
      executor: 'ramping-vus',
      gracefulStop: '30s',
      stages: [
        { target: 5, duration: '30s' },
        { target: 15, duration: '1m' },
        { target: 10, duration: '30s' },
        { target: 0, duration: '30s' },
      ],
      gracefulRampDown: '30s',
      exec: 'scenario_1',
    },
  },
};

const SITE = 'https://pizza.jwtpizza.click';
const SERVICE = 'https://pizza-service.jwtpizza.click';
const FACTORY = 'https://pizza-factory.cs329.click';

export function scenario_1() {
  let response;
  const vars = {};
  const json = { accept: '*/*', 'content-type': 'application/json', origin: SITE };

  group(`page_1 - ${SITE}/`, function () {
    // Home page
    response = http.get(`${SITE}/`);
    sleep(2);

    // Login
    response = http.put(`${SERVICE}/api/auth`, JSON.stringify({ email: 'd@jwt.com', password: 'diner' }), { headers: json });
    if (!check(response, { 'status equals 200': (r) => r.status.toString() === '200' })) {
      console.log(response.body);
      fail('Login was *not* 200');
    }
    vars.authToken = response.json().token;
    const auth = { ...json, authorization: `Bearer ${vars.authToken}` };
    sleep(2);

    // Get menu
    response = http.get(`${SERVICE}/api/order/menu`, { headers: auth });
    const menu = response.json();

    // Get franchises
    response = http.get(`${SERVICE}/api/franchise?page=0&limit=20&name=*`, { headers: auth });
    sleep(3);

    // Purchase pizza
    const items = menu.slice(0, 2).map((m) => ({ menuId: m.id, description: m.title, price: m.price }));
    response = http.post(`${SERVICE}/api/order`, JSON.stringify({ items, storeId: '1', franchiseId: 1 }), { headers: auth });
    if (!check(response, { 'order status equals 200': (r) => r.status.toString() === '200' })) {
      console.log(response.body);
      fail('Order was *not* 200');
    }
    vars.pizzaJwt = response.json().jwt;
    sleep(2);

    // Verify pizza
    response = http.post(`${FACTORY}/api/order/verify`, JSON.stringify({ jwt: vars.pizzaJwt }), { headers: auth });
    check(response, { 'verify status equals 200': (r) => r.status.toString() === '200' });
    sleep(1);

    // Order history
    response = http.get(`${SERVICE}/api/order`, { headers: auth });
    sleep(1);

    // Logout
    response = http.del(`${SERVICE}/api/auth`, null, { headers: auth });
  });
}
