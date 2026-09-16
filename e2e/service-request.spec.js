import { test, expect } from "@playwright/test";

async function choose(page, name) {
  await page
    .getByLabel("Demo employee", { exact: true })
    .selectOption({ label: name });
  await expect(page.getByRole("status")).not.toHaveText("Loading requests…");
}
async function draft(page, title) {
  await page
    .getByRole("button", { name: "＋ New request", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Problem description", { exact: true })
    .fill("My screen stays black. Please help me restart my laptop.");
  await page
    .getByLabel("Send to department", { exact: true })
    .selectOption({ label: "Information Technology" });
  await page
    .getByRole("radio", { name: "High Urgent problem Work is blocked" })
    .check();
}

test("employee submits, only receiving staff manages, and employee sees persisted progress and resolution", async ({
  page,
  request,
}) => {
  await page.goto("/app/");
  await choose(page, "Charbel Chouaifaty");
  const title = `Laptop will not start ${Date.now()}`;
  await draft(page, title);
  await page.getByRole("button", { name: "Send request ↗" }).click();
  await expect(page.getByRole("status")).toContainText(
    "sent to Information Technology",
  );
  let card = page.getByRole("button", { name: new RegExp(`^${title}`) });
  await expect(card).toContainText("High priority");
  await page.reload();
  await choose(page, "Charbel Chouaifaty");
  await card.click();
  const ticket = await page.locator("#details-dialog .eyebrow").innerText();
  await expect(
    page.getByRole("list", { name: "Request stages" }),
  ).toContainText("Upcoming");
  await expect(
    page.getByRole("button", { name: "Accept request", exact: true }),
  ).toHaveCount(0);
  const denied = await request.patch(`/requests/${ticket}/status`, {
    headers: { "x-employee-id": "employee-2" },
    data: { status: "Assigned" },
  });
  expect(denied.status()).toBe(403);
  await page.getByRole("button", { name: "Close request details" }).click();
  await choose(page, "Elie Massoud");
  await page.getByRole("button", { name: "Department inbox ↗" }).click();
  await expect(page.getByRole("status")).not.toHaveText("Loading requests…");
  await expect(card).toHaveCount(0);
  await choose(page, "Jean-Paul Chouaifaty");
  await page.getByRole("button", { name: "Department inbox ↗" }).click();
  await card.click();
  for (const [action, note, stage] of [
    ["Accept request", "IT has received this request.", "Assigned"],
    ["Start work", "Checking the charger.", "In Progress"],
    [
      "Mark completed",
      "Replaced the charger. Laptop starts normally.",
      "Completed",
    ],
  ]) {
    await page.getByLabel("Message to the employee").fill(note);
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/requests/${ticket}/status`) &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: action, exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(page.locator("#request-history")).toContainText(note);
  }
  await page.getByRole("button", { name: "Close request details" }).click();
  await choose(page, "Charbel Chouaifaty");
  await page
    .getByRole("button", { name: "Notifications — new updates", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Notifications" }),
  ).toContainText("Information Technology completed your request.");
  await page.screenshot({ path: 'test-results/completion-notification.png', fullPage: true });
  await page
    .getByRole("region", { name: "Notifications" })
    .getByRole("button", { name: new RegExp(`^${title}`) })
    .click();
  await expect(page.locator("#request-history")).toContainText(
    "Replaced the charger. Laptop starts normally.",
  );
  await expect(page.locator(".progress-step.current")).toContainText(
    "Completed",
  );
  await expect(
    page.getByRole("list", { name: "Request stages" }),
  ).not.toContainText("Upcoming");
  await expect(
    page.getByRole("button", { name: "Mark completed" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/employee-completed.png",
    fullPage: true,
  });
  await page.reload();
  await choose(page, "Charbel Chouaifaty");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Notifications" }),
  ).toContainText("Read");
  await expect(
    page.getByRole("button", { name: "Notifications — new updates" }),
  ).toHaveCount(0);
});

test("expected network failure keeps the draft and allows a successful retry", async ({
  page,
}) => {
  await page.goto("/app/");
  await choose(page, "Charbel Chouaifaty");
  const title = `Retry request ${Date.now()}`;
  await draft(page, title);
  await page.route("**/requests", async (route) => {
    if (route.request().method() === "POST") await route.abort("failed");
    else await route.continue();
  });
  await page.getByRole("button", { name: "Send request ↗" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Cannot reach the service",
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
  await expect(
    page.getByLabel("Problem description", { exact: true }),
  ).toHaveValue("My screen stays black. Please help me restart my laptop.");
  await page.unroute("**/requests");
  await page.getByRole("button", { name: "Send request ↗" }).click();
  await expect(page.getByRole("status")).toContainText(
    "sent to Information Technology",
  );
  await expect(
    page.getByRole("button", { name: new RegExp(`^${title}`) }),
  ).toHaveCount(1);
});

test("simple interface shows named stages without counters or filter controls", async ({
  page,
}) => {
  await page.goto("/app/");
  await expect(
    page.getByRole("list", { name: "Request journey" }),
  ).toContainText("SubmittedAcceptedIn progressCompleted");
  await expect(page.getByLabel("Find a request")).toHaveCount(0);
  await expect(page.getByLabel("Sort by")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Total requests/ }),
  ).toHaveCount(0);
});
