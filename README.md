# Internal Operations Service Hub — v0.3

A narrow employee-to-department request flow built with **React + Vite**, **NestJS**, and **Prisma + SQLite**, in the original repository.

Employees choose IT, Human Resources, or Finance, describe a problem, and select High, Medium, or Low priority. Receiving staff accepts and processes the request. The employee follows named stages and dated messages until completion. The interface intentionally has no numeric dashboard counters or search/filter toolbar.

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

If you already have this folder, start with `npm ci` inside it. `setup` installs the backend and frontend from their lockfiles, generates Prisma, creates SQLite tables, and seeds demo people and departments. No `.env` file is required. Existing requests are preserved when setup is repeated.

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
2. Click **New request**. Enter a title, problem description, destination department, and priority. Send it to **Information Technology**.
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

**Local demo identity:** the selector supplies `x-employee-id`. It is intentionally not production login: callers can switch that header. Membership and ownership checks are enforced for the selected identity. Company authentication is outside this slice; the server binds to the local machine.

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
docs/week3-full-stack-delivery.md  Assignment evidence and scope
```

See [the explicit API contract](docs/api-contract.md) and [Week 3 delivery](docs/week3-full-stack-delivery.md).

The main API routes are `/directory`, `POST /requests`, `GET /requests`, `GET /requests?department=it`, `GET /requests/:ticketNumber`, and `PATCH /requests/:ticketNumber/status`. Request endpoints require the demo employee header. Every request is persisted with its description, priority, destination, creator, status, and history.

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

`prisma db push` is used for this local teaching slice; versioned production migrations and deployment are not part of v0.3.

## Completion notifications

Choose an employee to see their in-app Notifications button. Completed requests appear there with the title, department, and completion time. A dot and short message indicate unread updates. Open a notification to view the request and mark it read; read state is saved in SQLite. Only the requesting employee can read or acknowledge their notification. Existing completed requests also appear.

Notifications refresh every 15 seconds while the page is visible, when the window regains focus, and when opening the panel. This is an in-app feature; it does not send email or operating-system push notifications.
