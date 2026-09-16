# Service Request API contract — v0.3

Base URL: `http://127.0.0.1:3000`. Requests/responses use JSON. Demo identity is the `x-employee-id` header. Request endpoints require a known employee; absent/unknown identity returns `401`. The directory endpoint is public for the local demo selector.

## Types

- `status`: `Submitted`, `Assigned`, `In Progress`, `Completed`, `Rejected`.
- `priority`: `High`, `Medium`, `Low` (omitted on creation defaults to Medium).
- Times are ISO-8601 UTC strings. A history note and changedBy may be null.
- Employee object: `{ "id": "employee-4", "displayName": "Charbel Chouaifaty", "email": "charbel@example.com" }`.
- Department object: `{ "id": "IT", "name": "Information Technology", "slug": "it" }`.

## POST /requests

Header: `x-employee-id: employee-4`.

```json
{"title":"Laptop will not start","description":"The screen stays black when I press power.","departmentSlug":"it","priority":"High"}
```

Title and description are trimmed and required (maximum 160 and 5,000 characters). Department slug is trimmed and lowercased, and must exist. Only the three listed priority values are accepted. Any known employee can send to any department.

Response `201` (ticket number varies):

```json
{"ticketNumber":"REQ-1001","status":"Submitted"}
```

Errors: `400` invalid/missing fields, unknown priority or department; `401` missing/unknown employee. Failed validation creates no request or history entry.

## GET /requests and GET /requests?department=it

Response `200`: array of request objects defined below, newest first. An empty collection is `[]`. Without department, returns only the selected employee's own requests. With department, requires membership in that department (`403` otherwise; nonexistent department `404`).

## GET /requests/:ticketNumber

Accepts either a ticket number or internal request ID. The creator and receiving-department staff may read it. Others receive `403`; missing request `404`.

Response `200`:

```json
{
  "requestId":"generated-internal-id",
  "ticketNumber":"REQ-1001",
  "title":"Laptop will not start",
  "description":"The screen stays black when I press power.",
  "priority":"High",
  "employee":{"id":"employee-4","displayName":"Charbel Chouaifaty","email":"charbel@example.com"},
  "department":{"id":"IT","name":"Information Technology","slug":"it"},
  "status":"Submitted",
  "createdAt":"2026-09-16T10:00:00.000Z",
  "updatedAt":"2026-09-16T10:00:00.000Z",
  "history":[{"status":"Submitted","occurredAt":"2026-09-16T10:00:00.000Z","note":"Request submitted.","changedBy":{"id":"employee-4","displayName":"Charbel Chouaifaty"}}]
}
```

## PATCH /requests/:ticketNumber/status

Receiving-department staff only. Example header: `x-employee-id: employee-1`.

```json
{"status":"Assigned","note":"IT received your request and will check your laptop."}
```

Response `200`:

```json
{"requestId":"REQ-1001","status":"Assigned"}
```

Here `requestId` echoes the supplied path identifier. Only permitted next states are accepted. Note is optional, trimmed, maximum 2,000 characters; rejection requires a nonblank reason. Success atomically updates the request and records the actor, time, prior/new status, and note. `400` for invalid transitions, malformed notes, missing rejection reason, or concurrent status changes; `403` for wrong department; `404` for unknown request; `401` for unknown identity.

## POST /requests/:ticketNumber/claim

Shortcut for a permitted Submitted → Assigned transition. Receiving staff only. No body required.

Response `201`: `{"ticketNumber":"REQ-1001","status":"Assigned"}`. A non-submitted request returns `400`; unauthorized staff `403`.

## GET /directory

Response `200`:

```json
{"employees":[{"id":"employee-1","displayName":"Jean-Paul Chouaifaty","memberships":[{"department":{"id":"IT","name":"Information Technology","slug":"it"}}]}],"departments":[{"id":"IT","name":"Information Technology","slug":"it"}]}
```

Illustrative abbreviated response; setup seeds four employees and three departments. Plain employees have an empty memberships array.

## Error shape

NestJS error response example:

```json
{"message":"Priority must be High, Medium, or Low.","error":"Bad Request","statusCode":400}
```

The frontend displays the message and retains an unsent draft on a failed submission. Network failures have no HTTP response and are handled separately. All example timestamps and IDs are illustrative.

## Completion notification endpoints

`GET /notifications` requires `x-employee-id` and returns only that employee's completed requests, newest first:

```json
[{"ticketNumber":"REQ-1001","title":"Laptop will not start","message":"Information Technology completed your request.","completedAt":"2026-09-16T10:00:00.000Z","readAt":null}]
```

`PATCH /notifications/:ticketNumber/read` marks the employee's completion notification as read. Returns `200` with `{"ticketNumber":"REQ-1001","read":true}`. An unknown or other employee's notification returns `404`; missing/unknown identity returns `401`. Acknowledgement preserves the request's status-update timestamp and audit history. Read state survives reconnects and reloads.
