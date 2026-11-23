import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Test-only API fixtures. Production always uses the real mail API.
const subjects = [
  "Website refresh — ready for your review",
  "A few notes before tomorrow",
  "Your weekly design digest",
  "Re: Launch checklist",
  "Coffee next week?",
  "Your pull request has been merged",
  "November project update",
  "The files you asked for",
  "Friday team lunch",
  "Re: A small idea",
  "Notes from our workshop",
  "See you on Monday",
];
const names = [
  "Maya Chen",
  "Alex Morgan",
  "Figma",
  "Sofia Patel",
  "Daniel Kim",
  "GitHub",
  "Emma Wilson",
  "Noah Williams",
  "Olivia Brown",
  "Lucas Garcia",
  "Charlotte Lee",
  "Henry Davis",
];
const snippets = [
  "The updated screens are ready. I’d love your thoughts on the new direction.",
  "Sharing the agenda so we can make the most of our time together.",
  "A little inspiration, new resources, and updates from your team.",
  "Everything looks good on my side. Just one small update to the timeline.",
];
const messages = subjects.map((subject, index) => ({
  uid: index + 1,
  messageId: `<${index}@example.test>`,
  threadId: `<${index}@example.test>`,
  from: {
    name: names[index],
    address: `${names[index].split(" ")[0].toLowerCase()}@example.test`,
  },
  to: [{ name: "Raman", address: "raman@example.test" }],
  subject,
  snippet: snippets[index % 4],
  date: new Date(2026, 10, 20, 10 - index).toISOString(),
  flags: [],
  isRead: index > 2,
  isStarred: [0, 3, 7].includes(index),
  hasAttachments: [0, 7].includes(index),
  labels: index === 0 ? ["label-projects"] : [],
  size: 1024,
}));
async function fixture(page: Page) {
  const writes: { path: string; method: string; body: any }[] = [];
  await page.addInitScript(() =>
    localStorage.setItem("freemailo-theme", "light"),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method !== "GET")
      writes.push({ path, method, body: request.postDataJSON() });
    const respond = (body: unknown) => route.fulfill({ json: body });
    if (path === "/api/auth/me")
      return respond({
        id: "test",
        email: "raman@example.test",
        displayName: "Raman Kumar",
        domain: "example.test",
        role: "mailbox",
      });
    if (path === "/api/mail/events")
      return route.fulfill({
        contentType: "text/event-stream",
        body: ": connected\n\n",
      });
    if (path === "/api/mail/folders")
      return respond({
        folders: ["INBOX", "Sent", "Drafts", "Archive", "Junk", "Trash"].map(
          (path) => ({
            path,
            name: path === "INBOX" ? "Inbox" : path,
            specialUse: path === "INBOX" ? null : `\\${path}`,
            total: path === "INBOX" ? 12 : 0,
            unread: path === "INBOX" ? 3 : 0,
            children: [],
            delimiter: "/",
          }),
        ),
      });
    if (path === "/api/settings/labels")
      return respond({
        labels: [
          { id: "label-projects", name: "Projects", color: "#7172b8" },
          { id: "label-personal", name: "Personal", color: "#2f8275" },
          { id: "label-finance", name: "Finance", color: "#af7931" },
        ],
      });
    if (path === "/api/settings/signatures")
      return respond({
        signatures: [
          {
            id: "signature-1",
            name: "Work",
            body: "<p>Kind regards,<br>Raman</p>",
          },
        ],
      });
    if (path === "/api/settings/trusted-senders")
      return respond({ senders: [] });
    if (path === "/api/settings/contacts")
      return respond({
        contacts: [{ email: "maya@example.test", displayName: "Maya Chen" }],
      });
    if (path.startsWith("/api/mail/draft"))
      return respond({ uid: 99, folder: "Drafts" });
    if (
      (path === "/api/mail/messages" || path === "/api/mail/search") &&
      method === "GET"
    ) {
      const q = url.searchParams.get("q") || "";
      let data = messages;
      if (q.includes("is:starred"))
        data = data.filter((message) => message.isStarred);
      if (q.includes("is:unread"))
        data = data.filter((message) => !message.isRead);
      if (q.includes("label:"))
        data = data.filter((message) => message.labels.includes(q.slice(6)));
      if (url.searchParams.get("folder") !== "INBOX") data = [];
      return respond({
        data,
        total: data.length,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      });
    }
    if (/\/api\/mail\/messages\/\d+$/.test(path)) {
      const message = messages.find(
        (item) => item.uid === Number(path.split("/").pop()),
      )!;
      return respond({
        ...message,
        cc: [{ name: "Alex", address: "alex@example.test" }],
        bcc: [],
        replyTo: [],
        htmlBody:
          '<p>Hi Raman,</p><p>The updated screens are ready for your review. I’ve incorporated the feedback from our last conversation and refined a few details.</p><p>Would love to hear what you think when you have a moment.</p><p>Thanks,<br>Maya</p><img src="https://tracking.invalid/pixel.png"><script>window.parent.alert("unsafe")</script>',
        textBody:
          "Hi Raman,\nThe updated screens are ready for your review.\nThanks, Maya",
        attachments: [],
        headers: {},
        authResults: { dkim: "pass", spf: "pass", dmarc: "pass" },
      });
    }
    return respond({ success: true });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Inbox", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-message-open]")).toHaveCount(12);
  return writes;
}
async function audit(page: Page) {
  // Wait for theme color transitions before measuring contrast.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running"),
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("iframe")
    .analyze();
  expect(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test("desktop and dark inbox: accessible and keyboard navigable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture(page);
  await audit(page);
  await page.screenshot({ path: "test-results/redesign-inbox-light.png" });
  await page.keyboard.press("j");
  await expect(page.locator('[data-message-open="1"]')).toBeFocused();
  await page.keyboard.press("j");
  await expect(page.locator('[data-message-open="2"]')).toBeFocused();
  await page.keyboard.press("/");
  await expect(
    page.getByRole("textbox", { name: "Search mail", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await audit(page);
  await page.screenshot({ path: "test-results/redesign-inbox-dark.png" });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(page.locator("#mail-navigation")).toHaveClass(/w-20/);
});

test("reading, reply-all, forward and rich compose preserve recipients", async ({
  page,
}) => {
  const writes = await fixture(page);
  let remoteRequests = 0;
  await page.route("https://tracking.invalid/**", (route) => {
    remoteRequests++;
    return route.abort();
  });
  await page.locator('[data-message-open="1"]').click();
  await expect(page.getByRole("heading", { name: subjects[0] })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Display images" }),
  ).toBeVisible();
  expect(remoteRequests).toBe(0);
  await expect(page.frameLocator("iframe").locator("script")).toHaveCount(0);
  await audit(page);
  await page.screenshot({ path: "test-results/redesign-reading.png" });
  await page.getByRole("button", { name: "Reply all", exact: true }).click();
  await expect(page.getByLabel("To", { exact: true })).toHaveValue(
    "maya@example.test, alex@example.test",
  );
  await page
    .getByRole("textbox", { name: "Message body" })
    .fill("Thanks, this looks great.");
  await page
    .getByRole("textbox", { name: "Message body" })
    .press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(page.locator(".mail-editor strong")).toHaveText(
    "Thanks, this looks great.",
  );
  await audit(page);
  await page.screenshot({ path: "test-results/redesign-compose.png" });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "New message" }),
  ).not.toBeVisible();
  const sent = writes.find((write) => write.path === "/api/mail/send");
  expect(sent?.body.to).toEqual(["maya@example.test", "alex@example.test"]);
  expect(sent?.body.htmlBody).toContain("<strong>");
  await page.getByRole("button", { name: "Forward", exact: true }).click();
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Message body" }),
  ).toContainText("Forwarded message");
});

test("starred and bulk label actions address the correct mailbox", async ({
  page,
}) => {
  const writes = await fixture(page);
  await page.getByRole("button", { name: "Starred", exact: true }).click();
  await expect(page.locator("[data-message-open]")).toHaveCount(3);
  await page.locator('[data-message-open="1"]').click();
  await expect(page.getByRole("heading", { name: subjects[0] })).toBeVisible();
  await page.getByRole("button", { name: "Archive (e)", exact: true }).click();
  await expect
    .poll(
      () =>
        writes.find((write) => write.path === "/api/mail/messages/move")?.body
          .sourceFolder,
    )
    .toBe("INBOX");
  await page.getByRole("button", { name: /^Inbox/ }).click();
  await expect(page.locator("[data-message-open]")).toHaveCount(12);
  await page
    .getByRole("checkbox", { name: "Select all messages", exact: true })
    .check();
  await page.getByRole("button", { name: "Apply label", exact: true }).click();
  await page.getByRole("menuitem", { name: "Projects", exact: true }).click();
  await expect
    .poll(() =>
      writes
        .filter((write) => write.path.endsWith("/flags"))
        .some((write) => write.body.flags.includes("FreeMailo_label-projects")),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator("[data-message-open]")).toHaveCount(1);
});

test("mobile navigation, settings and compose fit and remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await audit(page);
  await page.screenshot({ path: "test-results/redesign-mobile.png" });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(page.getByRole("dialog", { name: "FreeMailo" })).toBeVisible();
  await audit(page);
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New message" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await audit(page);
  await page.getByRole("button", { name: "Labels", exact: true }).click();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
});

test("error, retry, empty and offline states are distinct", async ({
  page,
  context,
}) => {
  await fixture(page);
  await page.route("**/api/mail/messages?**", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Mailbox temporarily unavailable" },
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Couldn’t load your mail" }),
  ).toBeVisible();
  await expect(page.getByText("Mailbox temporarily unavailable")).toBeVisible();
  await page.unroute("**/api/mail/messages?**");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("[data-message-open]")).toHaveCount(12);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No messages here" }),
  ).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/You’re offline/)).toBeVisible();
});

test("draft close saves, discard deletes the saved draft, and new compose is clean", async ({
  page,
}) => {
  const writes = await fixture(page);
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await page.getByLabel("To", { exact: true }).fill("maya@example.test");
  await page
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("Draft to keep");
  await page
    .getByRole("textbox", { name: "Message body" })
    .fill("Save this text.");
  await page.getByRole("button", { name: "Save and close" }).click();
  await expect(
    page.getByRole("dialog", { name: "New message" }),
  ).not.toBeVisible();
  expect(
    writes.find((write) => write.path === "/api/mail/draft")?.body.textBody,
  ).toBe("Save this text.");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Subject", exact: true }),
  ).toHaveValue("");
  await page.getByRole("textbox", { name: "Message body" }).fill("Discard me");
  await expect(
    page.getByText("Saved to Drafts", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect
    .poll(() =>
      writes.some(
        (write) =>
          write.path === "/api/mail/messages" &&
          write.method === "DELETE" &&
          write.body.permanent &&
          write.body.folder === "Drafts",
      ),
    )
    .toBe(true);
});

test("saved drafts reopen in compose and update their existing UID", async ({
  page,
}) => {
  const writes = await fixture(page);
  await page.route("**/api/mail/messages?**", (route) =>
    route.fulfill({
      json: {
        data: [{ ...messages[0], uid: 99, subject: "Saved draft" }],
        total: 1,
        page: 1,
        pageSize: 50,
      },
    }),
  );
  await page.route("**/api/mail/messages/99?**", (route) =>
    route.fulfill({
      json: {
        ...messages[0],
        uid: 99,
        subject: "Saved draft",
        cc: [],
        bcc: [],
        replyTo: [],
        htmlBody: "<p>Original draft text</p>",
        textBody: "Original draft text",
        headers: {},
        attachments: [],
      },
    }),
  );
  await page.getByRole("button", { name: "Drafts", exact: true }).click();
  await page.locator('[data-message-open="99"]').click();
  await expect(
    page.getByRole("textbox", { name: "Subject", exact: true }),
  ).toHaveValue("Saved draft");
  await expect(
    page.getByRole("textbox", { name: "Message body" }),
  ).toContainText("Original draft text");
  await page
    .getByRole("textbox", { name: "Message body" })
    .fill("Updated draft text");
  await page.getByRole("button", { name: "Save and close" }).click();
  await expect
    .poll(
      () =>
        writes.find((write) => write.path === "/api/mail/draft/99")?.body
          .textBody,
    )
    .toBe("Updated draft text");
  expect(writes.some((write) => write.path === "/api/mail/draft")).toBe(false);
});

test("server pagination never replaces a newly selected folder with a stale response", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/mail/messages?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("folder") !== "INBOX")
      return route.fulfill({ json: { data: [], total: 0 } });
    if (url.searchParams.get("page") === "2") {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return route.fulfill({
        json: {
          data: [{ ...messages[0], uid: 51, subject: "Older message" }],
          total: 51,
          page: 2,
          pageSize: 50,
        },
      });
    }
    return route.fulfill({
      json: {
        data: Array.from({ length: 50 }, (_, index) => ({
          ...messages[index % messages.length],
          uid: index + 1,
        })),
        total: 51,
        page: 1,
        pageSize: 50,
      },
    });
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("1–50 of 51", { exact: true })).toBeVisible();
  const secondPage = page.waitForResponse(
    (response) =>
      response.url().includes("/mail/messages?") &&
      new URL(response.url()).searchParams.get("page") === "2",
  );
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.getByRole("button", { name: "Sent", exact: true }).click();
  await secondPage;
  await expect(
    page.getByRole("heading", { name: "Sent", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No messages here" }),
  ).toBeVisible();
  await expect(page.getByText("Older message", { exact: true })).toHaveCount(0);
});
