import { expect, test } from '@playwright/test';

test('enter the temple and start a five-minute chant', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/^空山/);
  await expect(page.getByRole('heading', { name: '空山', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^入山/ }).click();
  await expect(page.locator('#intro')).toBeHidden();
  await expect(page.locator('canvas#scene')).toBeVisible();

  await page.getByRole('button', { name: '导览', exact: true }).click();
  await page.getByRole('button', { name: /诵经.*大殿蒲团/ }).click();
  await expect(page.getByRole('heading', { name: '坐下，念一部经' })).toBeVisible();
  const fiveMinutes = page.getByRole('button', { name: '5 分钟', exact: true });
  await fiveMinutes.click();
  await expect(fiveMinutes).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '开始诵经' }).click();

  const session = page.locator('#chant-session');
  await expect(session).toBeVisible();
  const timer = session.locator('#chant-timer');
  await expect(timer).toBeVisible();
  await expect(timer).toHaveText(/^(05:00|04:[0-5][0-9])$/);
  await expect(session.locator('#chant-fish')).toBeVisible();
  await expect(session.locator('#chant-voice')).toBeVisible();
  expect(errors).toEqual([]);
});
