import { test, expect } from './testSetup';
import { mockBackend, login } from './mockBackend';

test('home page', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');

  expect(await page.title()).toBe('JWT Pizza');
  await expect(page.getByText("The web's best pizza", { exact: true })).toBeVisible();
});

test('login and logout', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'd@jwt.com', 'a');

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();

  await page.getByRole('link', { name: 'Logout' }).click();
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'KC' })).not.toBeVisible();
});

test('login with bad password shows error', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'd@jwt.com', 'wrong');

  await expect(page.getByText('unknown user')).toBeVisible();
  await expect(page.getByRole('link', { name: 'KC' })).not.toBeVisible();
});

test('register', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByPlaceholder('Full name').fill('Pat Doe');
  await page.getByPlaceholder('Email address').fill('pat@jwt.com');
  await page.getByPlaceholder('Password').fill('pw');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('link', { name: 'PD' })).toBeVisible();
});

test('switch between login and register', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/login');
  await page.getByRole('main').getByText('Register', { exact: true }).click();
  await expect(page.getByText('Welcome to the party')).toBeVisible();
  await page.getByRole('main').getByText('Login', { exact: true }).click();
  await expect(page.getByText('Welcome back')).toBeVisible();
});

test('purchase with login, then verify', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Order now' }).click();
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByText('Here is your JWT Pizza!')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('0.008 ₿');
  await expect(page.getByRole('main')).toContainText('eyJpYXQ');

  const modal = page.locator('#hs-jwt-modal');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(modal).toHaveClass(/opened/);
  await expect(modal.locator('h3 span')).toHaveText('valid');
  await expect(modal).toContainText('"vendor"');
  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).not.toHaveClass(/open/);

  await page.getByRole('button', { name: 'Order more' }).click();
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
});

test('verify invalid pizza', async ({ page }) => {
  await mockBackend(page, { verifyValid: false });
  await page.goto('/delivery');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.locator('#hs-jwt-modal')).toHaveClass(/opened/);
  await expect(page.locator('#hs-jwt-modal h3 span')).toHaveText('invalid');
  await expect(page.getByText('bad pizza')).toBeVisible();
});

test('cancel payment and failed order', async ({ page }) => {
  await mockBackend(page, { failOrder: true });
  await page.goto('/');
  await login(page, 'd@jwt.com', 'a');
  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();

  await page.getByRole('link', { name: 'Order' }).click();
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.getByRole('main')).toContainText('Send me that pizza right now!');

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 1');
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByRole('button', { name: 'Pay now' }).click();
  await expect(page.getByText('Failed to fulfill order at factory')).toBeVisible();
});

test('diner dashboard without orders', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'd@jwt.com', 'a');
  await page.getByRole('link', { name: 'KC' }).click();

  await expect(page.getByText('Your pizza kitchen')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Kai Chen');
  await expect(page.getByRole('main')).toContainText('d@jwt.com');
  await expect(page.getByRole('main')).toContainText('diner');
  await expect(page.getByText('How have you lived this long without having a pizza?')).toBeVisible();
});

test('diner dashboard with orders', async ({ page }) => {
  const orders = [{ id: '7', franchiseId: '2', storeId: '4', date: '2024-06-05T05:14:40.000Z', items: [{ menuId: '1', description: 'Veggie', price: 0.05 }] }];
  await mockBackend(page, { orders });
  await page.goto('/');
  await login(page, 'f@jwt.com', 'a');
  await page.getByRole('link', { name: 'FC' }).click();

  await expect(page.getByRole('main')).toContainText('Franchisee on 2');
  await expect(page.getByText('Here is your history of all the good times.')).toBeVisible();
  await expect(page.locator('tbody')).toContainText('0.05 ₿');
  await expect(page.locator('tbody')).toContainText('2024-06-05');
});

test('franchise dashboard when not a franchisee', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Franchise' }).first().click();

  await expect(page.getByText('So you want a piece of the pie?')).toBeVisible();
  await expect(page.getByText('Unleash Your Potential')).toBeVisible();
});

test('franchisee creates and closes a store', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'f@jwt.com', 'a');
  await page.getByRole('link', { name: 'Franchise' }).first().click();

  await expect(page.getByText('LotaPizza')).toBeVisible();
  await expect(page.locator('tbody')).toContainText('Lehi');

  await page.getByRole('button', { name: 'Create store' }).click();
  await page.getByPlaceholder('store name').fill('Provo');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('tbody')).toContainText('Provo');

  await page.getByRole('row', { name: 'Provo' }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Sorry to see you go')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Provo');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('tbody')).not.toContainText('Provo');

  await page.getByRole('button', { name: 'Create store' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('LotaPizza')).toBeVisible();
});

test('admin manages franchises', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'a@jwt.com', 'admin');
  await page.getByRole('link', { name: 'Admin' }).click();

  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
  await expect(page.getByRole('table')).toContainText('LotaPizza');
  await expect(page.getByRole('table')).toContainText('Fran Chisee');
  await expect(page.getByRole('table')).toContainText('Springville');

  // Create a franchise
  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await page.getByPlaceholder('franchise name').fill('SliceWorks');
  await page.getByPlaceholder('franchisee admin email').fill('f@jwt.com');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('table')).toContainText('SliceWorks');

  // Close a store
  await page.getByRole('row', { name: 'Spanish Fork' }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('main')).toContainText('Spanish Fork');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('table')).not.toContainText('Spanish Fork');

  // Close a franchise
  await page.getByRole('row', { name: 'SliceWorks' }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('main')).toContainText('SliceWorks');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('table')).not.toContainText('SliceWorks');

  // Filter narrows the list
  await page.getByPlaceholder('Filter franchises').fill('corp');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('table')).toContainText('PizzaCorp');
  await expect(page.getByRole('table')).not.toContainText('LotaPizza');

  // Cancel out of create
  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
});

test('admin dashboard pagination', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'a@jwt.com', 'admin');
  await page.getByRole('link', { name: 'Admin' }).click();
  for (const name of ['Third', 'Fourth']) {
    await page.getByRole('button', { name: 'Add Franchise' }).click();
    await page.getByPlaceholder('franchise name').fill(name);
    await page.getByPlaceholder('franchisee admin email').fill('f@jwt.com');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
  }

  await expect(page.getByRole('table')).not.toContainText('Fourth');
  await page.getByRole('button', { name: '»' }).click();
  await expect(page.getByRole('table')).toContainText('Fourth');
  await page.getByRole('button', { name: '«' }).click();
  await expect(page.getByRole('table')).toContainText('LotaPizza');
});

test('admin dashboard hidden from diners', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/admin-dashboard');
  await expect(page.getByText('Oops')).toBeVisible();
});

test('static pages', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');

  await page.getByRole('link', { name: 'About' }).click();
  await expect(page.getByText('The secret sauce')).toBeVisible();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Mama Rucci, my my')).toBeVisible();

  await page.goto('/no-such-page');
  await expect(page.getByText('Oops')).toBeVisible();
});

test('docs page', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/docs');

  await expect(page.getByText('JWT Pizza API')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('[POST] /api/order');
  await expect(page.getByRole('main')).toContainText('Create an order');
});

test('factory docs page', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/docs/factory');
  await expect(page.getByRole('main')).toContainText('[POST] /api/order');
});
