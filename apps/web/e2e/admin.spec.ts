import { test, expect } from '@playwright/test';

test.describe('Phase 5: Admin Dashboard & DNS Tooling E2E', () => {
  test('Admin Flow: Authentication, Overview, Domains & DNS Tooling', async ({ page }) => {
    // 1. Admin Login
    await page.goto('/admin/login');
    await expect(page.locator('h1')).toContainText('MailHive Admin Console');

    await page.fill('#admin-email', 'admin@mailhive.local');
    await page.fill('#admin-password', 'admin123456');
    await page.click('button[type="submit"]');

    // 2. Overview Dashboard
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('h1')).toContainText('System Overview');
    await expect(page.getByText('Hosted Domains')).toBeVisible();
    await expect(page.getByText('Active Mailboxes')).toBeVisible();
    await expect(page.getByText('Infrastructure Health Matrix')).toBeVisible();

    // 3. Domains & DNS Tooling
    await page.getByRole('button', { name: 'Domains & DNS' }).click();
    await expect(page).toHaveURL('/admin/domains');
    await expect(page.locator('h1')).toContainText('Domain Management');

    // Verify existing seeded domain 'example.test'
    await expect(page.getByText('example.test').first()).toBeVisible();

    // Open DNS Setup Modal for example.test
    await page.locator('tr:has-text("example.test")').getByRole('button', { name: 'DNS Setup' }).click();
    await expect(page.getByText('DNS Configuration: example.test')).toBeVisible();

    // Verify MX, SPF, DKIM, DMARC records
    await expect(page.getByText('1. MX (Mail Exchange)')).toBeVisible();
    await expect(page.getByText('2. SPF (Sender Policy Framework)')).toBeVisible();
    await expect(page.getByText('3. DKIM (DomainKeys Identified Mail)')).toBeVisible();
    await expect(page.getByText('4. DMARC')).toBeVisible();
    await expect(page.getByText('PTR (Reverse DNS) & MTA-STS Recommendations')).toBeVisible();

    // Test Copy button
    await page.getByRole('button', { name: 'Copy' }).first().click();
    await expect(page.getByText('Copied').first()).toBeVisible();

    // Close DNS modal
    await page.getByRole('button', { name: 'Done' }).click();

    // 4. Mailboxes & Quotas
    await page.getByRole('button', { name: 'Mailboxes & Quota' }).click();
    await expect(page).toHaveURL('/admin/mailboxes');
    await expect(page.locator('h1')).toContainText('Mailbox Provisioning');

    // Verify Alice or Bob mailbox row
    await expect(page.getByText(/@example\.test/).first()).toBeVisible();
    await expect(page.getByText('MB').first()).toBeVisible(); // Quota indicator

    // 5. Aliases & Forwarding
    await page.getByRole('button', { name: 'Aliases & Forwarding' }).click();
    await expect(page).toHaveURL('/admin/aliases');
    await expect(page.locator('h1')).toContainText('Aliases & Forwarding');

    // 6. BullMQ Provisioning Queue
    await page.getByRole('button', { name: 'Provisioning Queue' }).click();
    await expect(page).toHaveURL('/admin/jobs');
    await expect(page.locator('h1')).toContainText('BullMQ Provisioning Queue');
    await expect(page.locator('tbody').getByText('COMPLETED').first()).toBeVisible();

    // 7. Audit Trail
    await page.getByRole('button', { name: 'Audit Trail' }).click();
    await expect(page).toHaveURL('/admin/audit');
    await expect(page.locator('h1')).toContainText('System Audit Trail');
  });
});
