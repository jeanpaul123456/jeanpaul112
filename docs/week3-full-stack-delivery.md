# v0.3 — Integrated Product Slice

## Product outcome

An employee asks IT, HR, or Finance for help without a phone call. They choose a department, enter a title and problem description, and select High, Medium, or Low priority. The request is saved, shown in My requests, and delivered to the receiving department's inbox. That department's staff accepts it, starts work, and completes it. The employee sees the current stage and an audit trail with dates, names, and staff messages.

This work continues in the original repository: https://github.com/jeanpaul123456/jeanpaul112 . No new project or external service is required.

## Architecture and boundaries

- React frontend: `frontend/src/App.jsx`. React components own selection, forms, request lists, dialogs, loading and error states. Styles retain the existing design. No legacy DOM-driven application runs alongside React.
- NestJS API: `backend/src/app.controller.ts` and `app.service.ts`. The backend validates input, resolves employees/departments, checks access, and enforces lifecycle rules.
- Prisma with real SQLite: `backend/prisma/schema.prisma`, `backend/src/database/`. Default local database: `backend/dev.db`.
- NestJS serves the Vite production build at `/app/`. Development can use Vite's local proxy.
- Explicit request/response contract: [API contract](api-contract.md).

The UI shows named stages rather than numerical counters. It has no search or filter toolbar. Priority is selected inside the submission form. Ticket numbers remain secondary references, while request titles, people, and departments are shown by name.

## Scope and state transitions

`Submitted → Assigned → In Progress → Completed`

The API's `Assigned` status appears as **Accepted** in the interface: staff have accepted the department's request. Any nonterminal state may move to `Rejected`, with a required reason. Completed and rejected requests cannot move to another state. Stages only show actual recorded events; future stages are marked Upcoming. No artificial completion percentage or promised response time is displayed.

Each request has a title, description, creator, destination department, priority, ticket number, timestamps, status, and status history. Submission and lifecycle history are committed transactionally. Ticket numbers use a transactional counter rather than a count of existing records. Existing requests survive setup and application restarts.

## Authorization: allowed and denied

**Rule:** only a staff member of the destination department may read that department's inbox or change its requests. A requester may read their own requests but cannot process them unless they are also receiving-department staff.

- Allowed: Charbel sends to IT; Jean-Paul, an IT member, accepts it (`200` on status PATCH).
- Denied: Elie, an HR member, attempts to accept that IT request (`403`). Neither status nor history changes.
- All employees, including staff, may submit to any valid department.

**Identity limitation:** this local teaching slice uses a documented demo employee selector and `x-employee-id`. It is not production authentication and the header can be changed by the caller. The server checks authorization for that selected identity. Company sign-in and trusted server-side identity are future work. The server binds to loopback.

## Invalid request deliberately rejected

A blank/whitespace description is rejected with `400` before writing data. An unknown priority or department is also rejected. The business rule rejects Submitted → Completed, preserving the existing status and history. Input validation exists at the API boundary, not just in browser form attributes.

## Expected failure deliberately handled

A network failure during submission displays a clear error and keeps the title, description, selected department, and priority in the open form. The send button is enabled again so the employee can retry. There is no success message or synthetic request on failure.

The browser test deliberately aborts the POST before it reaches the backend, checks that the draft is retained, restores connectivity, and verifies one successful request. The happy-path test does not mock the API or database. A missing ticket returns `404`. Failed detail loads support retry; failed list loads display an error rather than a false empty-state message.

## Automated evidence

Run all checks from the repository root after installation and browser setup:

```sh
npm run check
```

| Boundary / requirement | Evidence |
|---|---|
| Business rule unit test | `backend/src/app.service.spec.ts`: rejects a skipped state without writes; accepts completion with actor and resolution |
| Backend/database integration | `backend/test/requests.e2e-spec.ts`: actual temporary SQLite schema, HTTP operations through NestJS, creator/department/history persistence, reconnect and reread |
| Full browser E2E | `e2e/service-request.spec.js`: React form → NestJS → SQLite → receiving staff → requester sees completion and resolution |
| Authorization | API tests cover unauthorized readers and status writers; browser E2E checks HR denial and IT success |
| Expected failure | Browser aborts a submission request and verifies retained draft plus successful retry |
| Invalid input | API tests cover whitespace/malformed fields, unknown department and priority, long notes, and missing rejection reason |
| Regression | Existing tracking endpoint and lifecycle tests retained; priority persistence and progress rendering retained |
| Requested simple interface | Browser checks named stages and absence of numerical counters/search/sort controls |

Backend integration tests and browser tests use isolated temporary databases. Browser tests run a separate NestJS server on port 3101 and never alter the employee's `dev.db`. Test failures retain Playwright traces and screenshots in `test-results/`.

## Manual demonstration

1. Follow README setup, start the app, and choose Charbel Chouaifaty.
2. Send **Laptop will not start** to Information Technology with a description and High priority.
3. Open the saved request and observe Submitted, with other stages still upcoming.
4. Choose Elie Massoud. His HR inbox does not contain the IT request.
5. Choose Jean-Paul Chouaifaty, open Department inbox, and open the request.
6. Accept, start work, and mark completed; add a useful resolution message.
7. Return to Charbel. Open the request and confirm all recorded steps and messages.
8. Restart the application. The same request remains saved.

## Constraints and deferred work

The original Week 3 slice did not include external integrations or runtime AI. An optional AI review extension was added afterward (see below). RAG, MCP, CI/CD, deployment, monitoring, and production infrastructure remain out of scope. Authentication remains a demo seam. There is no real-time push, attachment storage, email notification, SLA guarantee, or request reassignment. Lists refresh while the visible page is idle; detail dialogs have Refresh status. Failed requests are not retried automatically, and submission idempotency after an ambiguous network loss is not implemented.

## Delivery

### Verified local results — September 16, 2026

- React/Vite and NestJS production builds passed.
- Packaged source was extracted into a clean directory; `npm ci`, `npm run setup`, and `npm run build` succeeded without using the original project's dependencies or database.
- 7 unit tests passed, including the service business rule.
- 36 endpoint/database regression tests passed.
- 3 full browser tests passed using installed Microsoft Edge (`PLAYWRIGHT_CHANNEL=msedge`). These used the isolated database and actual NestJS server.
- The completed-request screenshot was visually inspected: named stages, priority, actor names, and no numeric dashboard counters.

The README contains clean installation, execution, demo identities, and all test commands. Submit the URL of this same public GitHub repository; no new repository is needed. Publishing repository changes and sending the submission email are separate from the local build and verification.

## Completion notification addition

The requester now receives in-app completion notifications. They are derived from persisted completed requests, with database-backed read acknowledgement. The notification query is always scoped to the requester, including for department staff. Integration coverage verifies another employee cannot read or acknowledge the notification, persistence after reconnect, and unchanged request timestamps. The browser flow opens a completion notification and verifies read state after reload. Polling is every 15 seconds while visible; no external integration, email, or OS push service was added.


## Current project extension

This document records the Week 3 delivery and its dated verification results. The project now also includes automatic Gemini-assisted intake. The current implementation, live review evidence and remaining evaluation work are documented in [Week 4 delivery](week4-production-ai.md).

Passing a review creates a Submitted request. Department staff accept it, start work and complete it. The original manual API remains available. See [README](../README.md) for current setup and test commands, and [the API contract](api-contract.md) for endpoint behavior.
