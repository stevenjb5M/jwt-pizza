import { Page, Route } from '@playwright/test';
import { expect } from './testSetup';
import { Role, User, Franchise, Order } from '../src/service/pizzaService';

export const users: Record<string, User> = {
  'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
  'f@jwt.com': { id: '4', name: 'Fran Chisee', email: 'f@jwt.com', password: 'a', roles: [{ role: Role.Diner }, { role: Role.Franchisee, objectId: '2' }] },
  'a@jwt.com': { id: '1', name: '常用名字', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] },
};

export const menu = [
  { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
  { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
];

export interface MockOptions {
  orders?: Order[];
  failOrder?: boolean;
  verifyValid?: boolean;
}

// Mocks every pizza service and factory endpoint the frontend uses. State is kept per test,
// so creating or closing franchises and stores is reflected in later responses.
export async function mockBackend(page: Page, options: MockOptions = {}) {
  let loggedInUser: User | undefined;
  let nextId = 100;
  const orders: Order[] = options.orders ?? [];
  const franchises: Franchise[] = [
    {
      id: '2',
      name: 'LotaPizza',
      admins: [{ id: '4', name: 'Fran Chisee', email: 'f@jwt.com' }],
      stores: [
        { id: '4', name: 'Lehi', totalRevenue: 0.05 },
        { id: '5', name: 'Springville', totalRevenue: 0.1 },
      ],
    },
    { id: '3', name: 'PizzaCorp', admins: [], stores: [{ id: '7', name: 'Spanish Fork', totalRevenue: 0 }] },
  ];

  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body });

  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      loggedInUser = undefined;
      return json(route, { message: 'logout successful' });
    }

    const req = route.request().postDataJSON();
    if (method === 'POST') {
      const user: User = { id: String(nextId++), name: req.name, email: req.email, password: req.password, roles: [{ role: Role.Diner }] };
      users[req.email] = user;
      loggedInUser = user;
      return json(route, { user, token: 'abcdef' });
    }

    expect(method).toBe('PUT');
    const user = users[req.email];
    if (!user || user.password !== req.password) {
      return json(route, { message: 'unknown user' }, 404);
    }
    loggedInUser = user;
    return json(route, { user, token: 'abcdef' });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await json(route, loggedInUser ?? null);
  });

  await page.route('*/**/api/order/menu', async (route) => {
    expect(route.request().method()).toBe('GET');
    await json(route, menu);
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'GET') {
      return json(route, { id: loggedInUser?.id, dinerId: loggedInUser?.id, orders });
    }

    expect(route.request().method()).toBe('POST');
    if (options.failOrder) {
      return json(route, { message: 'Failed to fulfill order at factory' }, 500);
    }
    const order = { ...route.request().postDataJSON(), id: 23 };
    orders.push(order);
    await json(route, { order, jwt: 'eyJpYXQ' });
  });

  // Franchise list (?page=...), franchisee's franchises (/:userId), create, close, and store endpoints.
  await page.route(/\/api\/franchise(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const parts = url.pathname.split('/').filter(Boolean).slice(2); // after 'api', 'franchise'
    const method = request.method();

    if (parts.length === 0 && method === 'GET') {
      const name = (url.searchParams.get('name') ?? '*').replaceAll('*', '').toLowerCase();
      const limit = Number(url.searchParams.get('limit') ?? 10);
      const page = Number(url.searchParams.get('page') ?? 0);
      const matches = franchises.filter((f) => f.name.toLowerCase().includes(name));
      return json(route, { franchises: matches.slice(page * limit, (page + 1) * limit), more: matches.length > (page + 1) * limit });
    }

    if (parts.length === 0 && method === 'POST') {
      const req = request.postDataJSON();
      const franchise: Franchise = { id: String(nextId++), name: req.name, admins: req.admins, stores: [] };
      franchises.push(franchise);
      return json(route, franchise);
    }

    if (parts.length === 1 && method === 'GET') {
      return json(route, franchises.filter((f) => f.admins?.some((a) => a.id === parts[0])));
    }

    if (parts.length === 1 && method === 'DELETE') {
      franchises.splice(franchises.findIndex((f) => f.id === parts[0]), 1);
      return json(route, { message: 'franchise deleted' });
    }

    const franchise = franchises.find((f) => f.id === parts[0])!;
    if (parts.length === 2 && method === 'POST') {
      const store = { id: String(nextId++), name: request.postDataJSON().name, totalRevenue: 0 };
      franchise.stores.push(store);
      return json(route, store);
    }

    expect(method).toBe('DELETE');
    franchise.stores = franchise.stores.filter((s) => s.id !== parts[2]);
    await json(route, { message: 'store deleted' });
  });

  await page.route('*/**/api/docs', async (route) => {
    await json(route, {
      endpoints: [{ requiresAuth: true, method: 'POST', path: '/api/order', description: 'Create an order', example: 'curl -X POST /api/order', response: { jwt: 'abc' } }],
    });
  });

  await page.route('*/**/api/order/verify', async (route) => {
    if (options.verifyValid === false) {
      return json(route, { message: 'invalid' }, 400);
    }
    await json(route, { message: 'valid', payload: { vendor: { id: 'tst' }, order: { id: 23 } } });
  });
}

export async function login(page: Page, email: string, password: string) {
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}
