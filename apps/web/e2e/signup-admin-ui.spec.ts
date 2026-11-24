import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// UI-only fixtures: no account creation or infrastructure mutations.
const domains = [
  {
    id: "domain-1",
    name: "example.test",
    isActive: true,
    dkimSelector: "freemailo",
    createdAt: "2026-11-20T10:00:00Z",
  },
  {
    id: "domain-2",
    name: "studio.test",
    isActive: true,
    dkimSelector: "freemailo",
    createdAt: "2026-11-21T10:00:00Z",
  },
];
const mailbox = {
  id: "mailbox-1",
  email: "alice@example.test",
  domainId: "domain-1",
  usedBytes: 251658240,
  quotaBytes: 1073741824,
  isActive: true,
  createdAt: "2026-11-20T10:00:00Z",
};
const events = [
  {
    id: "event-1",
    action: "mailbox.create",
    actorType: "ADMIN",
    actorId: "admin-1",
    resourceType: "Mailbox",
    resourceId: "alice@example.test",
    ipAddress: "127.0.0.1",
    details: { email: "alice@example.test" },
    createdAt: "2026-11-20T10:00:00Z",
  },
];
async function setup(page: Page) {
  const writes: { path: string; method: string; body: any }[] = [];
  await page.addInitScript(() =>
    localStorage.setItem("freemailo-theme", "light"),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method !== "GET") {
      writes.push({
        path,
        method,
        body: request.postData() ? request.postDataJSON() : null,
      });
      if (path === "/api/auth/signup")
        return route.fulfill({
          status: 400,
          json: { message: "Please try again. Your details have been kept." },
        });
      return route.fulfill({ json: { success: true } });
    }
    const respond = (json: unknown) => route.fulfill({ json });
    if (path === "/api/auth/me")
      return respond({
        id: "admin-1",
        email: "admin@example.test",
        role: "SUPER_ADMIN",
      });
    if (path === "/api/auth/domains") return respond({ data: domains });
    if (path === "/api/auth/check-availability")
      return respond({
        available: true,
        email: `${url.searchParams.get("username")}@example.test`,
      });
    if (path === "/api/health")
      return respond({
        status: "healthy",
        services: Object.fromEntries(
          ["postgres", "redis", "postfix", "dovecot", "rspamd"].map((name) => [
            name,
            { status: "up", latencyMs: 2 },
          ]),
        ),
      });
    if (path.endsWith("/dns"))
      return respond({
        mx: { value: "10 mail.example.test" },
        spf: { value: "v=spf1 mx ~all" },
        dkim: {
          host: "freemailo._domainkey.example.test",
          value: "v=DKIM1; k=rsa; p=UIFixtureKey",
        },
        dmarc: { value: "v=DMARC1; p=quarantine" },
      });
    if (path === "/api/admin/domains")
      return respond({ data: domains, meta: { total: 2 } });
    if (path === "/api/admin/mailboxes")
      return respond({ data: [mailbox], meta: { total: 1 } });
    if (path === "/api/admin/aliases")
      return respond({
        data: [
          {
            id: "alias-1",
            sourceAddress: "hello@example.test",
            destinationEmail: "alice@example.test",
            createdAt: "2026-11-20T10:00:00Z",
          },
        ],
        meta: { total: 1 },
      });
    if (path === "/api/admin/jobs")
      return respond({
        data: [
          {
            id: "job-1",
            type: "CREATE_MAILBOX",
            status: "COMPLETED",
            attempts: 1,
            maxAttempts: 3,
            payload: { email: "alice@example.test" },
            createdAt: "2026-11-20T10:00:00Z",
          },
          {
            id: "job-2",
            type: "CREATE_DOMAIN",
            status: "FAILED",
            attempts: 3,
            maxAttempts: 3,
            lastError: "Example retry state for UI testing",
            createdAt: "2026-11-21T10:00:00Z",
          },
          {
            id: "job-3",
            type: "UPDATE_QUOTA",
            status: "PENDING",
            attempts: 0,
            maxAttempts: 3,
            payload: {},
            createdAt: "2026-11-21T10:00:00Z",
          },
        ],
        meta: { total: 3 },
      });
    if (path === "/api/admin/audit-log")
      return respond({ data: events, meta: { total: 1 } });
    return respond({});
  });
  return writes;
}
async function audit(page: Page) {
  // Measure the settled theme, rather than intermediate transition colors.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.effect?.getTiming().iterations === Infinity ||
          animation.playState !== "running",
      ),
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("signup stays stable while editing and preserves the signup request", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/signup");

  // Step 1: Name
  await expect(page.getByLabel("First name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Last name", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeVisible();

  // Next blocked if required fields empty
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Enter first name")).toBeVisible();

  await page.getByLabel("First name", { exact: true }).fill("David");
  await page.getByLabel("Last name", { exact: true }).fill("Smith");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 2: Birthday (optional)
  await expect(page.getByLabel("Date of birth", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 3: Email
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("david");
  await expect(
    page.getByRole("status").filter({ hasText: "is available" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 4: Password
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Confirm password", { exact: true }),
  ).toBeVisible();
  await page.locator("#password").fill("SecurePassword123!");
  await page.locator("#confirmPassword").fill("SecurePassword123!");

  // Verify back never loses data
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue("david");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#password")).toHaveValue("SecurePassword123!");
  await expect(page.locator("#confirmPassword")).toHaveValue("SecurePassword123!");

  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 5: Recovery email (optional)
  await expect(page.getByLabel("Recovery email", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 6: Review & Create
  await expect(
    page.getByRole("heading", { name: "Review and create" }),
  ).toBeVisible();
  await expect(page.getByText("david@example.test")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Your details have been kept" }),
  ).toContainText("Your details have been kept");
  await expect(
    page.getByRole("alert").filter({ hasText: "Your details have been kept" }),
  ).toBeInViewport();
  expect(
    writes.find((write) => write.path === "/api/auth/signup")?.body,
  ).toEqual({
    firstName: "David",
    lastName: "Smith",
    username: "david",
    domainId: "domain-1",
    password: "SecurePassword123!",
  });
});

test("signup is accessible on mobile in both themes with reduced motion", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/signup");

  // Step 1: Fill name
  await page.getByLabel("First name", { exact: true }).fill("David");
  await page.getByLabel("Last name", { exact: true }).fill("Smith");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 2: Skip birthday
  await page.getByRole("button", { name: "Skip", exact: true }).click();

  // Step 3: Email domain selection
  await expect(page.getByLabel("Email domain")).toHaveValue("domain-1");
  await page.getByLabel("Email domain").selectOption("domain-2");
  await page.getByLabel("Username", { exact: true }).fill("david");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 4: Password toggling
  await expect(page.locator("#password")).toBeVisible();
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#password")).toHaveAttribute("type", "text");

  await noOverflow(page);
  await audit(page);
  await page.screenshot({
    path: "/tmp/freemailo-ui-review/signup-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await audit(page);
  await page.screenshot({
    path: "/tmp/freemailo-ui-review/signup-dark.png",
    fullPage: true,
  });
  expect(
    await page
      .locator(".auth-card")
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
});

test("all admin pages share accessible light and dark surfaces", async ({
  page,
}) => {
  test.setTimeout(120000);
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  for (const path of [
    "/admin",
    "/admin/domains",
    "/admin/mailboxes",
    "/admin/aliases",
    "/admin/jobs",
    "/admin/audit",
    "/admin/login",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path !== "/admin/login")
      await expect(
        page.getByText("admin@example.test", { exact: true }),
      ).toBeVisible();
    await noOverflow(page);
    await audit(page);
    if (path === "/admin")
      await page.screenshot({
        path: "/tmp/freemailo-ui-review/admin-overview.png",
        fullPage: true,
      });
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await audit(page);
    if (path === "/admin/domains")
      await page.screenshot({
        path: "/tmp/freemailo-ui-review/admin-domains-dark.png",
        fullPage: true,
      });
  }
});

test("admin dialogs keep focus and existing domain mailbox alias requests", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/admin/domains");
  const addDomain = page.getByRole("button", {
    name: "Add Domain",
    exact: true,
  });
  await addDomain.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Domain Name (FQDN)").fill("NEW.TEST");
  await audit(page);
  await page
    .getByRole("button", { name: "Create Domain", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(addDomain).toBeFocused();
  expect(
    writes.find((write) => write.path === "/api/admin/domains")?.body,
  ).toEqual({ name: "new.test" });
  await page.getByRole("button", { name: "DNS Setup" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("UIFixtureKey");
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "DNS Setup" }).first(),
  ).toBeFocused();

  await page
    .getByRole("link", { name: "Mailboxes & Quota", exact: true })
    .click();
  await page.getByRole("button", { name: "Add Mailbox", exact: true }).click();
  await page.getByLabel("Mailbox Address", { exact: true }).fill("newuser");
  await page.getByLabel("Password", { exact: true }).fill("SecurePassword123!");
  await audit(page);
  await page
    .getByRole("button", { name: "Provision Mailbox", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Changes saved" }),
  ).toContainText("provisioning job queued successfully");
  await audit(page);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(
    writes.find((write) => write.path === "/api/admin/mailboxes")?.body,
  ).toEqual({
    localPart: "newuser",
    password: "SecurePassword123!",
    quotaBytes: 1073741824,
    domainId: "domain-1",
  });
  await page.getByRole("button", { name: "Edit Mailbox / Password" }).click();
  await audit(page);
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Aliases & Forwarding", exact: true })
    .click();
  await page.getByRole("button", { name: "Add Alias", exact: true }).click();
  await page.getByLabel("Source Address", { exact: true }).fill("contact");
  await page
    .getByLabel("Forward Destination Address")
    .fill("alice@example.test");
  await audit(page);
  await page.getByRole("button", { name: "Create Alias", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(
    writes.find((write) => write.path === "/api/admin/aliases")?.body,
  ).toEqual({
    sourceAddress: "contact@example.test",
    destinationMailboxId: "mailbox-1",
  });
});

test("admin mobile navigation, tables and dialogs fit small and landscape screens", async ({
  page,
}) => {
  test.setTimeout(90000);
  await setup(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Open admin navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit(page);
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Mailboxes & Quota" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await noOverflow(page);
  await page.screenshot({
    path: "/tmp/freemailo-ui-review/admin-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add Mailbox" }).click();
  await audit(page);
  await noOverflow(page);
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "/tmp/freemailo-ui-review/admin-mailbox-dialog.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 812, height: 375 });
  await noOverflow(page);
  await page.getByRole("button", { name: "Add Mailbox" }).click();
  const landscape = await page.getByRole("dialog").boundingBox();
  expect(landscape!.y).toBeGreaterThanOrEqual(0);
  expect(landscape!.y + landscape!.height).toBeLessThanOrEqual(375);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["domains", "mailboxes", "aliases", "jobs", "audit"]) {
    await page.goto(`/admin/${path}`);
    const table = page.getByRole("region", {
      name: `${path} table`,
      exact: false,
    });
    await expect(table.getByRole("cell").first()).toBeVisible();
    await noOverflow(page);
    await audit(page);
    await table.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => table.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await expect(table).toBeFocused();
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "System Overview" }),
  ).toBeVisible();
  await noOverflow(page);
  await page.goto("/signup");
  await noOverflow(page);
  await expect(page.locator("#firstName")).toHaveCSS("font-size", "16px");
});

test("admin confirmations preserve cancel behavior and errors keep form inputs", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/admin/aliases");
  const remove = page.getByRole("button", { name: "Delete alias" }).first();
  await remove.click();
  const confirmation = page.getByRole("dialog", { name: "Confirm deletion" });
  await expect(confirmation).toContainText("hello@example.test");
  await audit(page);
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(confirmation).toBeHidden();
  await expect(remove).toBeFocused();
  expect(writes.filter((write) => write.method === "DELETE")).toHaveLength(0);
  await remove.click();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  expect(writes.filter((write) => write.method === "DELETE")).toHaveLength(0);
  await remove.click();
  await confirmation
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(confirmation).toBeHidden();
  await expect
    .poll(() => writes.filter((write) => write.method === "DELETE"))
    .toEqual([
      { path: "/api/admin/aliases/alias-1", method: "DELETE", body: null },
    ]);

  await page.goto("/admin/domains");
  await page.route("**/api/admin/domains", async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({
        status: 400,
        json: { message: "This domain already exists." },
      });
    return route.fallback();
  });
  await page.getByRole("button", { name: "Add Domain", exact: true }).click();
  await page.getByLabel("Domain Name (FQDN)").fill("example.test");
  await page
    .getByRole("button", { name: "Create Domain", exact: true })
    .click();
  const error = page.getByRole("dialog", { name: "Unable to complete action" });
  await expect(error).toContainText("This domain already exists");
  await audit(page);
  await error.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByLabel("Domain Name (FQDN)")).toHaveValue(
    "example.test",
  );
  await expect(
    page.getByRole("dialog", { name: "Add Virtual Domain" }).locator(":focus"),
  ).toHaveCount(1);
});
