import { test, expect } from "@playwright/test";

test.describe("MailHive Gmail-Style Webmail UI E2E Flows", () => {
  test("Flow 1: Authentication, Layout, and Navigation", async ({ page }) => {
    // 1. Visit Login Page
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("Sign in to MailHive");

    // Check accessibility: form inputs must have labels
    await expect(
      page.locator('label[for="email"], label:has-text("Email Address")'),
    ).toBeVisible();
    await expect(
      page.locator('label[for="password"], label:has-text("Password")'),
    ).toBeVisible();

    // 2. Sign in as Alice
    await page.fill("#email", "alice@example.test");
    await page.fill("#password", "alice123456");
    await page.click('button[type="submit"]');

    // 3. Verify redirect to main webmail UI
    await expect(page).toHaveURL("/");

    // 4. Verify Navbar components
    await expect(page.locator("header")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "MailHive home" }),
    ).toBeVisible();
    await expect(page.locator("#global-search-input")).toBeVisible();

    // 5. Verify Sidebar and folders
    await expect(page.getByRole("button", { name: /compose/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /inbox/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /starred/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sent/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /drafts/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /trash/i })).toBeVisible();
  });

  test("Flow 2: Message List, Star, and Reading Pane", async ({ page }) => {
    // Login as Bob
    await page.goto("/login");
    await page.fill("#email", "bob@example.test");
    await page.fill("#password", "bob123456");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // Compose an email to Bob to guarantee INBOX has a fresh message
    await page.getByRole("button", { name: /compose/i }).click();
    await page.fill(
      'input[placeholder="Recipients (comma separated)"]',
      "bob@example.test",
    );
    await page.fill('input[placeholder="Subject"]', "Bob Welcome Message");
    await page
      .getByRole("textbox", { name: "Message body" })
      .fill("Welcome to MailHive webmail!");
    await page.click('button[type="submit"]:has-text("Send")');

    // Wait for message to appear in list
    await page.waitForSelector(".group", { timeout: 10000 });
    const messageRows = page.locator(".group");
    const count = await messageRows.count();
    expect(count).toBeGreaterThan(0);

    // Click on the first message to open Reading Pane
    await messageRows.first().click();

    // Verify Reading Pane appears
    await expect(page.locator('iframe[title="Email Content"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /reply/i }).first(),
    ).toBeVisible();

    // Verify SPF / DKIM verification badges
    await expect(page.getByText(/DKIM:/)).toBeVisible();
    await expect(page.getByText(/SPF:/)).toBeVisible();

    // Return back to list
    await page.click('button[title*="Back to list"]');
    await expect(page.locator(".group").first()).toBeVisible();
  });

  test("Flow 3: Compose and Send Email Modal", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill("#email", "alice@example.test");
    await page.fill("#password", "alice123456");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // Open Compose modal
    await page.getByRole("button", { name: /compose/i }).click();

    // Verify Compose floating modal appears
    await expect(
      page.getByPlaceholder("Recipients (comma separated)"),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Subject")).toBeVisible();

    // Fill email
    const uniqueSubject = `Playwright UI Test ${Date.now()}`;
    await page.fill(
      'input[placeholder="Recipients (comma separated)"]',
      "bob@example.test",
    );
    await page.fill('input[placeholder="Subject"]', uniqueSubject);
    await page
      .getByRole("textbox", { name: "Message body" })
      .fill("This is an automated test from Playwright.");

    // Send email
    await page.click('button[type="submit"]:has-text("Send")');

    // Verify compose closes after sending
    await expect(
      page.getByRole("textbox", { name: "Message body" }),
    ).not.toBeVisible({ timeout: 10000 });
  });

  test("Flow 4: Keyboard Shortcuts Overlay", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill("#email", "alice@example.test");
    await page.fill("#password", "alice123456");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // Open keyboard shortcuts with '?' button
    await page.click('button[aria-label="Keyboard Shortcuts"]');
    await expect(
      page.getByRole("dialog", { name: "Keyboard Shortcuts" }),
    ).toBeVisible();
    await expect(page.getByText("Compose a new message")).toBeVisible();

    // Close shortcuts modal with Escape
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Keyboard Shortcuts" }),
    ).not.toBeVisible();
  });

  test("Flow 5: Settings Dialog and Tabs", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill("#email", "alice@example.test");
    await page.fill("#password", "alice123456");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // Open settings modal
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

    // Check tabs
    await expect(
      page.getByRole("button", { name: "Profile", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Signatures" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Labels" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Trusted Senders" }),
    ).toBeVisible();

    // Switch to Signatures tab
    await page.getByRole("button", { name: "Signatures" }).click();
    await expect(page.getByText("Create New Signature")).toBeVisible();

    // Close settings modal with Escape
    await page.keyboard.press("Escape");
  });
});
