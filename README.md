# Internal Operations Service Hub

A company request portal built with **React + Vite**, **NestJS**, and **Prisma + SQLite**. Employees send problems to the right department and follow their progress. The Week 4 extension adds Gemini-assisted request intake to the same repository.

Employees choose IT, Human Resources, or Finance, describe a problem, and select High, Medium, or Low priority. Department staff accept and process the request. The employee follows named stages and dated messages until completion. The interface intentionally has no numeric dashboard counters or search/filter toolbar.

## Final release handoff

**Live app: [Open Service Hub](https://jeanpaul112.onrender.com/app/).** Select Charbel Chouaifaty to submit a fictional request; select Jean-Paul Chouaifaty to handle IT requests. No password is needed for the demo. The September 28 live check verified AI submission, staff processing, completion notifications and wrong-department denial. Server-restart persistence and controlled failure/recovery remain pending; see [release operations](docs/week5-release-operations.md). Continue using the same [public repository](https://github.com/jeanpaul123456/jeanpaul112).

The [submission guide](docs/final-submission.md) contains the four email recipients, exact subject format, required fields, push commands and defense checklist. Deadline: **September 30, 2026 at 12:00 PM Beirut time**.

| Evidence | Where to look |
|---|---|
| Week 1: product and design | [Product](docs/product-spec.md), [architecture](docs/architecture.md), [data model](docs/data-model.md), [ADR-001](docs/decisions/ADR-001.md) |
| Week 2: engineering ownership | [Workflow](docs/week2-agentic-workflow.md) |
| Week 3: full stack | [Delivery](docs/week3-full-stack-delivery.md), [API contract](docs/api-contract.md) |
| Week 4: runtime AI | [AI delivery](docs/week4-production-ai.md), [latest eval results](docs/week4-ai-eval-results.json) |
| Week 5: release and operations | [Deployment, health, logs and recovery](docs/week5-release-operations.md) |

After installing the test browser and configuring Gemini, run `npm run release:gate`. It checks the deterministic suite and live AI evaluations and writes a dated report. After deployment, run `npm run smoke -- https://YOUR-SERVICE.onrender.com`, then complete the documented browser journey and recovery checks.

## Prerequisites

- Node.js **22.13+** on the Node 22 line, or a newer compatible Node version (verified with Node 26.8).
- npm and Git.
- Internet access for npm packages and the Playwright browser download on first setup.
- Available local ports 3000 (app) and 3101 (isolated browser tests).

## Clean installation

### Using the project folder

The project is a normal folder containing `frontend/`, `backend/`, `docs/`, and the root `package.json`. A ZIP is only an optional transport copy; it is not needed to run or edit the project. Open a terminal in this folder and run the commands below starting at `npm ci`. If dependencies and the database are already prepared, use `npm run build` followed by `npm start`.

Stop a running development server before reinstalling dependencies. Keep `backend/dev.db` to preserve your saved requests and notification read state.

### Installing from GitHub

Run these commands in PowerShell, Terminal, or another shell:

```sh
git clone https://github.com/jeanpaul123456/jeanpaul112.git
cd jeanpaul112
npm ci
npm run setup
npm run build
npm start
```

If you already have this folder, start with `npm ci` inside it. `setup` installs the backend and frontend from their lockfiles, generates Prisma, creates SQLite tables, and seeds demo people and departments. No `.env` file is required for offline checks. To use live Gemini, follow the AI setup section below. Existing requests are preserved when setup is repeated.

Open **http://localhost:3000/app/**. Keep the terminal running. Stop it with Ctrl+C.

The backend serves the compiled React app from `frontend/dist`. After editing code, stop the server, run `npm run build`, then `npm start` again.

## Development with live reload (optional)

After setup, use two terminals in the repository root:

```sh
npm --prefix backend run start:dev
```

```sh
npm --prefix frontend run dev
```

Open http://localhost:5173/app/. Vite proxies API requests to the backend on port 3000.

## Exercise the complete flow

1. Choose **Charbel Chouaifaty** in Demo employee.
2. Click **New request**. For example, use the title “Laptop will not start” and describe what happened, what you tried, and how work is affected. Choose **Information Technology** and a priority, then click **Send request**. The configured checker runs automatically. If feedback appears, correct the draft and send again.
3. Open the request in My requests: it is Submitted, and the remaining stages are Upcoming.
4. Choose **Jean-Paul Chouaifaty**, open Department inbox, and open the request.
5. Click Accept request, then Start work, then Mark completed. Include a useful message such as “Replaced the charger and verified startup.”
6. Return to Charbel. Open Notifications, then open the completion notification. Verify the status, named actors, dates, and resolution message. The notification becomes read and stays read after a reload.
7. Restart the server. The request is still saved in `backend/dev.db`.

The UI calls the API's **Assigned** state **Accepted**. Staff may reject an active request with a required reason. Completed/rejected requests cannot change state. All employees can submit to all departments.

| Employee | Demo ID (API only) | Staff inbox |
|---|---|---|
| Jean-Paul Chouaifaty | employee-1 | Information Technology |
| Elie Massoud | employee-2 | Human Resources |
| Maria Boutros | employee-3 | Finance |
| Charbel Chouaifaty | employee-4 | None; requester |

**Authorization demonstration:** Jean-Paul can process an IT request; Elie cannot. The UI does not show other departments' inboxes, and the API also rejects a forged wrong-department operation with `403`. A sender can read their own request but cannot process it unless they belong to the receiving department.

**Demo identity:** the selector supplies `x-employee-id`. It is intentionally not production login: callers can switch that header. Membership and ownership checks are enforced for the selected identity. Local startup binds to the local machine; hosting uses `HOST=0.0.0.0`. Use fictional data only in the public teaching demo.

## Automated tests

Install the Chromium test browser once:

```sh
npx playwright install chromium
```

If Microsoft Edge is already installed on Windows, you can use it without downloading another browser:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run check
```

This is the browser used for the verified local E2E run. Omit that environment variable to use Playwright's downloaded Chromium.

On Linux, if the browser reports missing system libraries, use `npx playwright install --with-deps chromium`.

Run all verification:

```sh
npm run check
```

Or run individual layers (browser E2E requires a completed build):

```sh
npm test
npm run test:api
npm run test:e2e
```

- Unit tests: a real service business rule and frontend progress rendering.
- API/database tests: NestJS HTTP endpoints plus temporary SQLite, persistence after reconnect, authorization, input rejection, priority, history, and existing tracking/lifecycle regression coverage.
- Browser E2E: real React → NestJS → SQLite submission and completion; completion notifications and saved read status; wrong-department denial; network failure retains the draft and permits retry; simple interface regression checks.

Browser tests start their own server on port **3101** and create a new isolated database under `.tmp/`. They do not change `backend/dev.db` or need the normal app to be running. API tests use the OS temporary directory. Playwright retains failure screenshots and traces in `test-results/`; open a trace with `npx playwright show-trace <trace.zip>`.

## Files and API contract

```text
frontend/src/                 React components, API helper, tracking, styles
backend/src/                  NestJS routes, business rules, database service
backend/prisma/               Schema, initial test SQL, non-destructive seed
backend/test/                 Endpoint and real SQLite tests
e2e/                          Full browser tests
scripts/e2e-server.mjs        Isolated test database and server
docs/api-contract.md          Request/response shapes and error behavior
docs/week3-full-stack-delivery.md  Week 3 evidence and scope
docs/week4-production-ai.md       AI design, verification and evaluation plan
```

See [the API contract](docs/api-contract.md), [Week 3 delivery](docs/week3-full-stack-delivery.md), and [Week 4 AI delivery](docs/week4-production-ai.md). The Week 4 document explains the AI boundaries, live test evidence, and evaluation work that remains.

The employee form submits through `POST /ai/submit-request`. `POST /ai/review-request` reviews without creating a request, and `GET /ai/config` returns the selected review mode. The legacy `POST /requests` endpoint still supports manual intake without an AI review.

The other main API routes are `/directory`, `POST /requests`, `GET /requests`, `GET /requests?department=it`, `GET /requests/:ticketNumber`, and `PATCH /requests/:ticketNumber/status`. Request endpoints require the demo employee header. Every request is persisted with its description, priority, destination, creator, status, and history.

## Expected failure and recovery

If sending fails before the backend receives it, the form keeps the entered text, displays a connection error, and enables retry. No successful request is invented in the UI. The browser test deliberately exercises this failure. A rare lost response after the server commits can be ambiguous: check My requests before resubmitting; idempotency keys are not implemented.

## Troubleshooting

- **Cannot connect:** keep `npm start` running, use `/app/`, and check the terminal for errors.
- **Page missing:** run `npm run build`; Nest serves `frontend/dist`, not the source files.
- **Tables/client missing:** run `npm run db:setup` then rebuild. Do not delete your database to fix this.
- **Port busy:** stop the conflicting local server or set `PORT` in the backend environment. E2E needs port 3101 free and does not reuse another server.
- **Browser executable missing:** run `npx playwright install chromium`.
- **Native tool blocked:** allow the installed Prisma/test runner to execute subprocesses in your development environment; do not disable system-wide protections.

## Schema changes

After changing `backend/prisma/schema.prisma`, run database setup and regenerate the isolated-test schema:

```sh
npm run db:setup
cd backend
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/schema.sql
```

`prisma db push` is only used locally. Remote startup uses the transactional baseline/checksum deployment script; see [Week 5](docs/week5-release-operations.md). Never point local setup commands at the remote database.

## Completion notifications

Choose an employee to see their in-app Notifications button. Completed requests appear there with the title, department, and completion time. A dot and short message indicate unread updates. Open a notification to view the request and mark it read; read state is saved in SQLite. Only the requesting employee can read or acknowledge their notification. Existing completed requests also appear.

Notifications refresh every 15 seconds while the page is visible, when the window regains focus, and when opening the panel. This is an in-app feature; it does not send email or operating-system push notifications.

## AI-assisted request intake

Gemini reviews the draft when the employee clicks **Send request**. It checks whether the title and description make sense together, flags missing or contradictory details, and suggests wording, department and priority.

For example, a title about a broken laptop and a description about unpaid expenses should prompt clarification and a Finance suggestion. Suggestions appear below the description. **Accept corrections** changes the draft only; sending again triggers another check.

The backend validates the result. If there are concerns or a department mismatch, it keeps the draft and creates no request. If the review passes, it saves the employee's submitted wording and selections as **Submitted**.

**AI check → Submitted → Accepted → In Progress → Completed**

AI does not accept work, verify facts, or resolve the problem. Department staff control acceptance, work and completion. The model can make mistakes, including asking for clarification when a request is already valid.

### Set up Gemini

1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Use a project on the Free tier if you want to avoid paid usage. Free access has quotas, and the app cannot verify your billing tier.
3. Copy `backend/.env.example` to `backend/.env` only if that file does not already exist. Otherwise edit the existing file.
4. Set the following values:

```env
REQUEST_REVIEW_MODE=gemini
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Save the file, run `npm run build`, and restart with `npm start`. The backend reads the settings at startup. No OpenAI key is needed for Gemini.

Keep the key private. `backend/.env` is ignored by Git and must not be committed. A new checkout needs its own local configuration.

Gemini receives the draft fields and department catalog, not employee identity records or request history. Google's free-tier data policy allows content to be used to improve its products, so use fictional practice requests rather than confidential company information. See [Google's pricing and data-use information](https://ai.google.dev/gemini-api/docs/pricing).

### Run without an AI provider

Set `REQUEST_REVIEW_MODE=local` and restart. This is also the default when the setting is absent; a fresh checkout can run without a key.

Local mode checks minimum title/description length and some obvious placeholder or repeated text. It keeps the selected department and priority. **These are programmed rules, not AI understanding.** No draft is sent to an external service.

The earlier OpenAI integration is still available through `REQUEST_REVIEW_MODE=openai`, with `OPENAI_API_KEY` and `OPENAI_MODEL`. It requires separate API access and may incur charges. The app does not switch providers automatically. The form displays a disclosure for the mode returned by the backend.

### When AI cannot review a request

A missing key, exhausted quota, unavailable provider, timeout, or invalid model response leaves the draft in the form. No request is created and no paid fallback is attempted. Check the configuration or quota, then retry. To use offline checks instead, explicitly select local mode and restart.

## Verification and Week 4 status

Verification on September 26 passed **71 tests**: 25 unit tests, 41 API/database tests and 5 browser tests. Both builds passed. This includes release migration preservation/rollback and database readiness. Remote hosting still needs separate verification.

Automated AI tests use simulated provider responses. They check validation and failure handling without making paid calls. Browser coverage includes a real local-mode submission through the backend and isolated SQLite database; the manual lifecycle regression uses the legacy API.

Two live Gemini reviews also succeeded on September 22, 2026: a clear laptop request returned no concerns, and a contradictory laptop/expenses request returned concerns and suggested Finance. Those review-only calls did not create requests.

## Run the AI evaluations

With a valid Gemini key saved in backend/.env, run:

```sh
npm run eval:ai
```

This builds the backend and runs eight cases from [evals/request-intake.json](evals/request-intake.json): six live Gemini semantic reviews and two simulated failure cases. It checks clear, thin and contradictory input, trusted department context, priority based on work impact, invalid output and provider failure. The runner exercises real backend review/submission logic but replaces persistence, so it creates no actual requests.

Live cases need internet access and use Gemini quota. No paid-provider fallback is attempted. Stay on the provider's free tier if avoiding charges. The suite fails visibly on unavailable quota or other live-call failures; it does not silently substitute mock answers.

The command exits nonzero when any case fails and saves the model, time, assertions and results in [docs/week4-ai-eval-results.json](docs/week4-ai-eval-results.json). The rubric checks meaning-related outcomes, not exact wording; live results may vary. See [Week 4 delivery](docs/week4-production-ai.md) for details. Run `npm run check` separately for deterministic regression tests.


Read the latest dated AI evaluation JSON report for the current outcome. Historical timeout failures remain in the separate reports. The provider timeout is 60 seconds and failures return HTTP 504. A past pass does not guarantee future provider availability. See the Week 5 release document for the remote verification still required.
