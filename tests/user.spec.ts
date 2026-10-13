import { Page } from '@playwright/test';
import { test, expect } from './testSetup';
import { mockBackend, login, users } from './mockBackend';
import { Role } from '../src/service/pizzaService';

async function registerDiner(page: Page) {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();
  return email;
}

async function submitEdit(page: Page) {
  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });
}

test('updateUser', async ({ page }) => {
  await mockBackend(page);
  const email = await registerDiner(page);

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await submitEdit(page);

  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

test('update email and password', async ({ page }) => {
  await mockBackend(page);
  const email = await registerDiner(page);
  const newEmail = `new${email}`;

  await page.getByRole('link', { name: 'pd' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('textbox').nth(1).fill(newEmail);
  await page.getByRole('textbox').nth(2).fill('newpassword');
  await submitEdit(page);

  await expect(page.getByRole('main')).toContainText(newEmail);

  await page.getByRole('link', { name: 'Logout' }).click();
  await login(page, email, 'diner');
  await expect(page.getByText('unknown user')).toBeVisible();

  await page.getByPlaceholder('Email address').fill(newEmail);
  await page.getByPlaceholder('Password').fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('unknown user')).toBeVisible();

  await page.getByPlaceholder('Password').fill('newpassword');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText(newEmail);
});

test('update keeps roles', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'f@jwt.com', 'a');

  await page.getByRole('link', { name: 'FC' }).click();
  await expect(page.getByRole('main')).toContainText('Franchisee on 2');

  await page.getByRole('button', { name: 'Edit' }).click();
  await submitEdit(page);

  await expect(page.getByRole('main')).toContainText('Fran Chisee');
  await expect(page.getByRole('main')).toContainText('diner');
  await expect(page.getByRole('main')).toContainText('Franchisee on 2');

  await page.getByRole('link', { name: 'Logout' }).click();
  await login(page, 'f@jwt.com', 'a');
  await page.getByRole('link', { name: 'FC' }).click();

  await expect(page.getByRole('main')).toContainText('Franchisee on 2');
});

test('admin lists users', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'a@jwt.com', 'admin');
  await page.getByRole('link', { name: 'Admin' }).click();

  const usersTable = page.getByRole('table', { name: 'Users' });
  await expect(usersTable).toContainText('Kai Chen');
  await expect(usersTable).toContainText('d@jwt.com');
  await expect(usersTable).toContainText('diner');
  await expect(usersTable).toContainText('Fran Chisee');
  await expect(usersTable).toContainText('franchisee');
});

test('admin filters and pages users', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await login(page, 'a@jwt.com', 'admin');
  await page.getByRole('link', { name: 'Admin' }).click();

  const usersTable = page.getByRole('table', { name: 'Users' });
  await page.getByPlaceholder('Filter users').fill('kai');
  await page.getByRole('button', { name: 'Search users' }).click();
  await expect(usersTable).toContainText('Kai Chen');
  await expect(usersTable).not.toContainText('Fran Chisee');
  await expect(page.getByRole('button', { name: 'Previous users' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next users' })).toBeDisabled();

  await page.getByPlaceholder('Filter users').fill('');
  await page.getByRole('button', { name: 'Search users' }).click();
  await expect(usersTable).toContainText('Fran Chisee');
});

test('admin pages through users', async ({ page }) => {
  await mockBackend(page);
  const pagers = Array.from({ length: 12 }, (_, i) => `page${i}@jwt.com`);
  pagers.forEach((email, i) => (users[email] = { id: `p${i}`, name: `Pager ${i}`, email, password: 'a', roles: [{ role: Role.Diner }] }));
  try {
    await pageThroughUsers(page);
  } finally {
    pagers.forEach((email) => delete users[email]);
  }
});

async function pageThroughUsers(page: Page) {
  await page.goto('/');
  await login(page, 'a@jwt.com', 'admin');
  await page.getByRole('link', { name: 'Admin' }).click();

  const usersTable = page.getByRole('table', { name: 'Users' });
  await page.getByPlaceholder('Filter users').fill('pager');
  await page.getByRole('button', { name: 'Search users' }).click();
  await expect(usersTable).toContainText('Pager 0');
  await expect(usersTable).not.toContainText('Pager 11');

  await page.getByRole('button', { name: 'Next users' }).click();
  await expect(usersTable).toContainText('Pager 11');
  await expect(usersTable).not.toContainText('Pager 0');

  await page.getByRole('button', { name: 'Previous users' }).click();
  await expect(usersTable).toContainText('Pager 0');
}

test('admin deletes user', async ({ page }) => {
  await mockBackend(page);
  const email = 'doomed@jwt.com';
  users[email] = { id: '900', name: 'Doomed Diner', email, password: 'a', roles: [{ role: Role.Diner }] };
  try {
    await page.goto('/');
    await login(page, 'a@jwt.com', 'admin');
    await page.getByRole('link', { name: 'Admin' }).click();

    const usersTable = page.getByRole('table', { name: 'Users' });
    await expect(usersTable).toContainText('Doomed Diner');
    await usersTable.getByRole('row', { name: 'Doomed Diner' }).getByRole('button', { name: 'Delete' }).click();
    await expect(usersTable).not.toContainText('Doomed Diner');
    await expect(usersTable).toContainText('Kai Chen');

    await page.getByRole('link', { name: 'Logout' }).click();
    await login(page, email, 'a');
    await expect(page.getByText('unknown user')).toBeVisible();
  } finally {
    delete users[email];
  }
});
