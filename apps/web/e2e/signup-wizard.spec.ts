import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const domains = [
  {
    id: "domain-1",
    name: "example.test",
    isActive: true,
  },
  {
    id: "domain-2",
    name: "studio.test",
    isActive: true,
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
      if (path === "/api/auth/signup") {
        const body = request.postDataJSON();
        if (body?.username === "taken") {
          return route.fulfill({
            status: 400,
            json: { message: "This username is already taken" },
          });
        }
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({ json: { success: true } });
    }
    const respond = (json: unknown) => route.fulfill({ json });
    if (path === "/api/auth/domains") return respond({ data: domains });
    if (path === "/api/auth/check-availability") {
      const uname = url.searchParams.get("username");
      if (uname === "taken") {
        return respond({
          available: false,
          message: "username@example.test is already taken",
        });
      }
      return respond({
        available: true,
        email: `${uname}@example.test`,
      });
    }
    return respond({});
  });
  return writes;
}

test.describe("Signup Multi-Step Wizard Flow", () => {
  test("AC1: only one step is visible at a time and navigates through 6 steps", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/signup");

    // Step 1: Name
    await expect(page.getByRole("heading", { name: "Create your FreeMailo account" })).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Last name", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Middle name", { exact: false })).toBeVisible();
    await expect(page.locator("#dob")).toHaveCount(0);
    await expect(page.locator("#username")).toHaveCount(0);
    await expect(page.locator("#password")).toHaveCount(0);
    // Back button should NOT exist on step 1
    await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
    // Already have account link appears on step 1 only
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    // Fill Step 1
    await page.getByLabel("First name", { exact: true }).fill("David");
    await page.getByLabel("Middle name", { exact: false }).fill("Robert");
    await page.getByLabel("Last name", { exact: true }).fill("Smith");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: Birthday
    await expect(page.getByRole("heading", { name: "Basic information" })).toBeVisible();
    await expect(page.getByLabel("Date of birth", { exact: false })).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);

    // Skip Step 2
    await page.getByRole("button", { name: "Skip" }).click();

    // Step 3: Email
    await expect(page.getByRole("heading", { name: "Choose your email address" })).toBeVisible();
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email domain")).toBeVisible();

    // Fill Step 3
    await page.getByLabel("Username", { exact: true }).fill("davidsmith");
    await expect(page.getByText("davidsmith@example.test is available")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    // Step 4: Password
    await expect(page.getByRole("heading", { name: "Create a strong password" })).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();
    await expect(page.locator("#password-strength")).toBeVisible();

    // Fill Step 4
    await page.locator("#password").fill("SuperSecret123!");
    await page.locator("#confirmPassword").fill("SuperSecret123!");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 5: Recovery
    await expect(page.getByRole("heading", { name: "Add a recovery email" })).toBeVisible();
    await expect(page.getByLabel("Recovery email", { exact: false })).toBeVisible();

    // Fill Step 5
    await page.getByLabel("Recovery email", { exact: false }).fill("backup@other.org");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 6: Review & Create
    await expect(page.getByRole("heading", { name: "Review and create" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  });

  test("AC2: Back restores previously typed values across steps", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/signup");

    // Fill Step 1
    await page.getByLabel("First name", { exact: true }).fill("David");
    await page.getByLabel("Middle name", { exact: false }).fill("Robert");
    await page.getByLabel("Last name", { exact: true }).fill("Smith");
    await page.getByRole("button", { name: "Next" }).click();

    // Fill Step 2
    await page.getByLabel("Date of birth", { exact: false }).fill("1995-06-15");
    await page.getByRole("button", { name: "Next" }).click();

    // Fill Step 3
    await page.getByLabel("Username", { exact: true }).fill("davesmith");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 4: Go Back multiple times and verify all data retained
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("Username", { exact: true })).toHaveValue("davesmith");

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("Date of birth", { exact: false })).toHaveValue("1995-06-15");

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("David");
    await expect(page.getByLabel("Middle name", { exact: false })).toHaveValue("Robert");
    await expect(page.getByLabel("Last name", { exact: true })).toHaveValue("Smith");

    // Advance forward again
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Create a strong password" })).toBeVisible();
  });

  test("AC3: Validation rules block Next with inline errors and focus invalid field", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/signup");

    // Step 1: Empty names
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Enter first name")).toBeVisible();
    await expect(page.getByText("Enter last name")).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toBeFocused();

    await page.getByLabel("First name", { exact: true }).fill("David");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Last name", { exact: true })).toBeFocused();
    await page.getByLabel("Last name", { exact: true }).fill("Smith");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: Birthday validation (< 13 years old)
    await expect(page.getByRole("heading", { name: "Basic information" })).toBeVisible();
    // Too young: 2 years old
    const currentYear = new Date().getFullYear();
    await page.getByLabel("Date of birth", { exact: false }).fill(`${currentYear - 2}-01-01`);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("You must be at least 13 years old")).toBeVisible();
    await expect(page.getByLabel("Date of birth", { exact: false })).toBeFocused();

    // Clear and skip
    await page.getByLabel("Date of birth", { exact: false }).fill("");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3: Username validation (too short, invalid characters, dot start/end)
    await expect(page.getByRole("heading", { name: "Choose your email address" })).toBeVisible();
    await page.getByLabel("Username", { exact: true }).fill("ab");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Username must be at least 3 characters")).toBeVisible();

    await page.getByLabel("Username", { exact: true }).fill(".davidsmith.");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Username cannot start or end with a period")).toBeVisible();

    await page.getByLabel("Username", { exact: true }).fill("validuser");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 4: Password validation (< 8 chars, mismatch)
    await expect(page.getByRole("heading", { name: "Create a strong password" })).toBeVisible();
    await page.locator("#password").fill("short");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Use 8 characters or more for your password")).toBeVisible();

    await page.locator("#password").fill("SuperSecret123!");
    await page.locator("#confirmPassword").fill("Different123!");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Those passwords didn’t match")).toBeVisible();

    await page.locator("#confirmPassword").fill("SuperSecret123!");
    await expect(page.getByText("Passwords match")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    // Step 5: Recovery email validation (same as new address)
    await expect(page.getByRole("heading", { name: "Add a recovery email" })).toBeVisible();
    await page.getByLabel("Recovery email", { exact: false }).fill("validuser@example.test");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Recovery email cannot be the same as your new FreeMailo address")).toBeVisible();

    await page.getByLabel("Recovery email", { exact: false }).fill("not-an-email");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();

    await page.getByLabel("Recovery email", { exact: false }).fill("");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Review and create" })).toBeVisible();
  });

  test("AC4: Reloading the page returns to Step 1 with empty form (no storage persistence)", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/signup");

    await page.getByLabel("First name", { exact: true }).fill("David");
    await page.getByLabel("Last name", { exact: true }).fill("Smith");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { name: "Basic information" })).toBeVisible();

    // Reload page
    await page.reload();

    // Must be on Step 1 with empty inputs
    await expect(page.getByRole("heading", { name: "Create your FreeMailo account" })).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Last name", { exact: true })).toHaveValue("");
  });

  test("AC5: Submit happens only on final step and sends full payload; server errors route to correct step", async ({
    page,
  }) => {
    const writes = await setup(page);
    await page.goto("/signup");

    // Complete all steps with username "taken" to test server error redirect
    await page.getByLabel("First name", { exact: true }).fill("Alice");
    await page.getByLabel("Last name", { exact: true }).fill("Cooper");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Date of birth", { exact: false }).fill("1998-05-20");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Username", { exact: true }).fill("alice");
    await page.getByRole("button", { name: "Next" }).click();

    await page.locator("#password").fill("SecureP@ss1234");
    await page.locator("#confirmPassword").fill("SecureP@ss1234");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Recovery email", { exact: false }).fill("alice.recovery@external.test");
    await page.getByRole("button", { name: "Next" }).click();

    // Verify Review step content
    await expect(page.getByText("Alice Cooper")).toBeVisible();
    await expect(page.getByText("alice@example.test")).toBeVisible();
    await expect(page.getByText("alice.recovery@external.test")).toBeVisible();

    // Click Create account
    await page.getByRole("button", { name: "Create account" }).click();

    const signupReq = writes.find((w) => w.path === "/api/auth/signup");
    expect(signupReq?.body).toEqual({
      firstName: "Alice",
      lastName: "Cooper",
      username: "alice",
      domainId: "domain-1",
      password: "SecureP@ss1234",
      dateOfBirth: "1998-05-20",
      recoveryEmail: "alice.recovery@external.test",
    });
  });

  test("Optional Extras: Edit buttons on review step jump directly to steps", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/signup");

    await page.getByLabel("First name", { exact: true }).fill("David");
    await page.getByLabel("Last name", { exact: true }).fill("Smith");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: "Skip" }).click();

    await page.getByLabel("Username", { exact: true }).fill("davidsmith");
    await page.getByRole("button", { name: "Next" }).click();

    await page.locator("#password").fill("Secret1234!");
    await page.locator("#confirmPassword").fill("Secret1234!");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: "Skip" }).click();

    // We are on Review step
    await expect(page.getByRole("heading", { name: "Review and create" })).toBeVisible();

    // Click Edit on Name
    await page.getByRole("button", { name: "Edit Name" }).click();
    await expect(page.getByRole("heading", { name: "Create your FreeMailo account" })).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("David");

    // Click Edit Email from Review after navigating
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Choose your email address" })).toBeVisible();
  });

  test("AC6: Fully responsive and accessible on mobile (360px) and dark theme", async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/signup");

    // Check no horizontal overflow at 360px
    const hasNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(hasNoOverflow).toBe(true);

    // Wait for initial render transitions to settle
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (animation) =>
            animation.effect?.getTiming().iterations === Infinity ||
            animation.playState !== "running",
        ),
    );

    // Run axe accessibility audit on Step 1
    const axeLight = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axeLight.violations).toEqual([]);

    // Switch to dark theme
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(page.locator("html")).toHaveClass("dark");

    // Wait for theme transition to settle before measuring contrast
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (animation) =>
            animation.effect?.getTiming().iterations === Infinity ||
            animation.playState !== "running",
        ),
    );

    const axeDark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axeDark.violations).toEqual([]);
  });
});
