import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audits (WCAG 2.1 AA)', () => {
  test('Login Page Accessibility Check', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('h1');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Calculate score / verify 0 critical or serious violations
    const violations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    console.log(`Login page violations count: ${violations.length}`);
    expect(violations).toEqual([]);
  });

  test('Main Webmail App Accessibility Check', async ({ page }) => {
    // Sign in
    await page.goto('/login');
    await page.fill('#email', 'alice@example.test');
    await page.fill('#password', 'alice123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.waitForSelector('header');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('iframe') // iframe content is sandboxed external email
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    console.log(`Webmail app critical/serious violations: ${criticalViolations.length}`);
    expect(criticalViolations).toEqual([]);
  });
});
