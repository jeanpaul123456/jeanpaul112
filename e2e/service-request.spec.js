import { test, expect } from "@playwright/test";

// Preserve the original manual-lifecycle regression through the legacy API.
// Automatic AI submission is tested separately below and against SQLite.
test.beforeEach(async ({ page, request }) => {
  await page.route("**/ai/submit-request", async (route) => {
    const response = await request.post("/requests", {
      headers: {
        Cookie: (await page.context().cookies()).map(c => c.name + "=" + c.value).join("; "),
        "Idempotency-Key": route.request().headers()["idempotency-key"],
      },
      data: route.request().postDataJSON(),
    });
    await route.fulfill({ response });
  });
});

async function choose(page, name) {
  await expect(page.getByText('Checking your session…')).toHaveCount(0);
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count()) {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  }
  const emails = { 'Charbel Chouaifaty': 'charbel@gmail.com', 'Jean-Paul Chouaifaty': 'jeanpaul@gmail.com', 'Elie Massoud': 'elie@gmail.com' };
  await page.getByLabel('Email address').fill(emails[name]);
  await page.getByLabel('Username', { exact: true }).fill(emails[name].split('@')[0]);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Signed in as ' + name)).toBeVisible();
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

test('login rejects mismatched usernames, survives reload and signs out securely', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '＋ New request', exact: true })).toHaveCount(0);
  await page.getByLabel('Email address').fill('charbel@gmail.com');
  await page.getByLabel('Username', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or username is incorrect.');
  await page.screenshot({ path: 'test-results/employee-login.png', fullPage: true });
  await choose(page, 'Charbel Chouaifaty');
  await page.reload();
  await expect(page.getByText('Signed in as Charbel Chouaifaty')).toBeVisible();
  await expect(page.getByLabel('Demo employee')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

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
  const hrLogin = await request.post('/auth/login', { data: { email: 'elie@gmail.com', username: 'elie' } });
  const denied = await request.patch(`/requests/${ticket}/status`, {
    headers: { Cookie: hrLogin.headers()['set-cookie'].split(';')[0] },
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
  await page.screenshot({
    path: "test-results/completion-notification.png",
    fullPage: true,
  });
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
  request,
}) => {
  await page.goto("/app/");
  await choose(page, "Charbel Chouaifaty");
  const title = `Retry request ${Date.now()}`;
  await draft(page, title);
  let firstKey;
  const failAfterCommit = async (route) => {
    const submitted = route.request();
    firstKey = submitted.headers()["idempotency-key"];
    const saved = await request.post("/requests", {
      headers: {
        Cookie: (await page.context().cookies()).map(c => c.name + "=" + c.value).join("; "),
        "Idempotency-Key": firstKey,
      },
      data: submitted.postDataJSON(),
    });
    expect(saved.status()).toBe(201);
    await route.abort("failed");
  };
  await page.route("**/ai/submit-request", failAfterCommit);
  await page.getByRole("button", { name: "Send request ↗" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Cannot reach the service",
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
  await expect(
    page.getByLabel("Problem description", { exact: true }),
  ).toHaveValue("My screen stays black. Please help me restart my laptop.");
  await page.unroute("**/ai/submit-request", failAfterCommit);
  let retryKey;
  page.on("request", (retry) => {
    if (
      retry.url().endsWith("/ai/submit-request") &&
      retry.method() === "POST"
    )
      retryKey = retry.headers()["idempotency-key"];
  });
  await page.getByRole("button", { name: "Send request ↗" }).click();
  await expect(page.getByRole("status")).toContainText(
    "sent to Information Technology",
  );
  await expect(
    page.getByRole("button", { name: new RegExp(`^${title}`) }),
  ).toHaveCount(1);
  expect(retryKey).toBe(firstKey);
  const requests = await request.get("/requests", {
    headers: { Cookie: (await page.context().cookies()).map(c => c.name + "=" + c.value).join("; ") },
  });
  expect((await requests.json()).filter((item) => item.title === title)).toHaveLength(1);
});

test("simple interface shows named stages without counters or filter controls", async ({
  page,
}) => {
  await page.goto("/app/");
  await choose(page, 'Charbel Chouaifaty');
  await expect(
    page.getByRole("list", { name: "Request journey" }),
  ).toContainText("SubmittedAcceptedIn progressCompleted");
  await expect(page.getByLabel("Find a request")).toHaveCount(0);
  await expect(page.getByLabel("Sort by")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Total requests/ }),
  ).toHaveCount(0);
});

test("automatic AI check shows concerns and preserves the draft on failure", async ({
  page,
}) => {
  await page.goto("/app/");
  await choose(page, "Charbel Chouaifaty");
  await draft(page, "Laptop issue");
  await expect(
    page.getByRole("button", { name: "Review with AI" }),
  ).toHaveCount(0);
  const review = {
    improvedTitle: "Laptop screen stays black",
    improvedDescription: "My laptop screen stays black.",
    suggestedDepartmentSlug: "it",
    suggestedPriority: "Medium",
    explanation: "Please clarify the contradictory details.",
    concerns: ["Is the screen black or working?"],
  };
  await page.route("**/ai/submit-request", (route) =>
    route.fulfill({
      status: 400,
      json: { message: "Please clarify your request before sending.", review },
    }),
  );
  await page.getByRole("button", { name: "Send request ↗" }).click();
  await expect(page.getByText(review.concerns[0])).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Laptop issue",
  );
  await page.getByRole("button", { name: "Accept corrections" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    review.improvedTitle,
  );
  await page.route("**/ai/submit-request", (route) =>
    route.fulfill({
      status: 502,
      json: { message: "AI unavailable. Your draft is unchanged." },
    }),
  );
  await page.getByRole("button", { name: "Send request ↗" }).click();
  await expect(
    page.getByText("AI unavailable. Your draft is unchanged."),
  ).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    review.improvedTitle,
  );
});

test("free local submission needs no API key and awaits department acceptance", async ({
  page,
}) => {
  await page.unroute("**/ai/submit-request");
  await page.goto("/app/");
  await choose(page, "Charbel Chouaifaty");
  const title = `Free local laptop request ${Date.now()}`;
  await draft(page, title);
  await page.getByRole("button", { name: "Send request ↗" }).click();
  await expect(page.getByRole("status")).toContainText(
    "sent to Information Technology",
  );
  await expect(
    page.getByRole("button", { name: new RegExp(`^${title}`) }),
  ).toContainText("Submitted");
});
