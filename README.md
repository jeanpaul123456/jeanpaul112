# Internal Operations Service Hub — Week 3

A focused internal service-request application where employees submit requests to IT, Human Resources, or Finance and department staff process them.

The project delivers one complete, user-facing flow:

1. An employee selects their identity in the React frontend.
2. They submit a service request to a department.
3. The backend persists it in SQLite and returns a friendly ticket number such as `REQ-1005`.
4. The request can be loaded with that ticket number.
5. A staff member in the assigned department can claim the request.

## Technology

- React + Vite frontend
- NestJS + TypeScript backend
- Prisma ORM
- SQLite local database
- Vitest + Supertest automated tests

## Project structure

```text
frontend/                    React user interface
backend/                     NestJS API and SQLite database
backend/prisma/              Prisma schema, seed data, and migration setup
backend/test/                Endpoint and SQLite integration tests
docs/week3-full-stack-delivery.md
```

## Run locally

### Prerequisites

- Node.js 20 or later
- npm

### 1. Install every workspace

```bash
npm install
```

This installs the backend, React frontend, and shared root commands. Prisma's
generated client is created automatically.

### 2. Prepare the local database

```bash
cp backend/.env.example backend/.env
npm run db:setup
```

The SQLite database is created locally at `backend/dev.db`. Run this again to
restore the original sample employees and requests.

### 3. Start both applications

```bash
npm run dev
```

This starts the NestJS API on [http://localhost:3000](http://localhost:3000)
and the React development server on [http://localhost:5173](http://localhost:5173).
Open the React application at [http://localhost:5173/app/](http://localhost:5173/app/).

To serve the production React build from NestJS instead, run `npm run build`
inside `frontend`, then start the backend from `backend` with `npm run start:prod`.

## Sample employees and requests

| Ticket | Requester | Request | Department | Status |
|---|---|---|---|---|
| `REQ-1001` | Jean-Paul Chouaifaty | Laptop does not start | IT | Submitted |
| `REQ-1002` | Elie Massoud | Annual leave request | HR | Completed |
| `REQ-1003` | Maria Boutros | Travel expense reimbursement | Finance | Rejected |
| `REQ-1004` | Charbel Chouaifaty | VPN access request | IT | In Progress |

Massoud, George Alam, and Jean-Paul are seeded as department staff members for the authorization example.

## API contract

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/requests` | Create a request. Requires `x-employee-id` and `title`, `description`, `departmentSlug`. |
| `GET` | `/requests/:ticketNumber` | Retrieve a persisted request, requester, department, and history. |
| `POST` | `/requests/:ticketNumber/claim` | Claim a submitted request. Requires `x-employee-id`. |
| `PATCH` | `/requests/:ticketNumber/status` | Apply a permitted status transition. |

Status lifecycle:

```text
Submitted → Assigned → In Progress → Completed
```

Requests may also be rejected. Invalid transitions are rejected with `400`.

## Authorization and error handling

- Only staff in the request's assigned department may claim it.
- Allowed example: Jean-Paul can claim an IT request.
- Denied example: an employee outside the assigned department receives `403`.
- Missing title, description, or department produces `400`.
- An unknown ticket produces `404`; the React UI displays the message.

## Tests

Prepare the database first using the commands above, then run:

```bash
npm test
npm run test:e2e
```

The suite includes:

- A real SQLite integration test for persisted employee, department, request, and history data.
- Request status business-rule regression tests.
- API endpoint E2E tests for valid and invalid request transitions.
- Existing tracking endpoint regression tests.

## Delivery notes

See [docs/week3-full-stack-delivery.md](docs/week3-full-stack-delivery.md) for the Week 3 integrated product-slice summary and verification cases.

## Troubleshooting

**The frontend says it cannot reach the API.** Confirm `npm run dev` is still
running and open the frontend URL printed by Vite (normally port 5173).

**The database is missing or tests fail before they start.** Run
`npm run db:setup` from the repository root.

**Port 3000 or 5173 is busy.** Stop the other local process using that port,
then run `npm run dev` again.
