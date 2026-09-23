# Service Request API contract

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

## GET /ai/config

Public local-demo endpoint. Returns 200 with the configured mode, for example:

```json
{"mode":"gemini"}
```

No credentials are returned. The frontend uses this to explain how the draft will be checked.

## POST /ai/review-request

Requires a known employee in `x-employee-id`. Reviews a draft without creating a request or changing history.

```json
{"title":"Laptop will not start","description":"My laptop does not start even with its charger connected. I cannot access my work and need IT assistance.","departmentSlug":"it","priority":"High"}
```

Title and description must be nonblank strings, at most 160 and 5,000 characters. Priority is required and must be Low, Medium or High. A supplied department slug must match the database catalog; review alone allows an empty or omitted department.

Response 201 contains `improvedTitle`, `improvedDescription`, `suggestedDepartmentSlug`, `suggestedPriority`, `explanation`, and `concerns`. Explanation is nonblank and at most 1,500 characters. Concerns contain at most five nonblank strings of at most 500 characters each. Suggested departments and priorities are checked against product-owned values. Local mode also returns `source: "local"`.

Provider output is independently validated and displayed as text. The provider receives only draft fields and the database department catalog, not employee identity or request history.

## POST /ai/submit-request

This is the employee form's submission endpoint. It takes the same header and draft fields as review. A valid destination department is required to create the request.

The backend checks the exact submitted draft. If there are concerns or the suggested department differs from the selected one, it returns 400:

```json
{"message":"Please clarify your request before sending.","review":{"improvedTitle":"Expense reimbursement","improvedDescription":"Please help with my unpaid travel expenses.","suggestedDepartmentSlug":"finance","suggestedPriority":"Medium","explanation":"The description concerns expenses rather than an IT issue.","concerns":["The title and description describe different problems."]}}
```

No request is created in that case. The employee may accept corrections or edit the draft; sending again checks the new draft.

On success, response 201 is:

```json
{"ticketNumber":"REQ-1001","status":"Submitted"}
```

The original submitted wording, department and priority are persisted, with one submission history entry. Suggestions are never silently applied. AI does not accept or start work. Only receiving department staff can move the request through Submitted → Assigned (Accepted in the UI) → In Progress → Completed, or reject it under the existing rules.

The legacy `POST /requests` endpoint remains available without an AI review. AI checking is therefore an intake feature, not a universal authorization boundary.

### Review modes and failures

| Mode | Behavior |
| --- | --- |
| `gemini` | Google Gemini structured review; requires GEMINI_API_KEY. Default model: gemini-3.5-flash-lite. |
| `local` or unset | Offline completeness and placeholder rules. No external call and no semantic AI understanding. |
| `openai` | Optional OpenAI integration using its separate credentials. |

Unrecognized mode values currently use local checks. In Gemini mode, low-level network failures and selected provider-rejection responses use the deterministic `gemini-fallback` review so the draft can still be checked against the trusted department catalog. Gemini timeouts, quota errors, blocked or incomplete responses, and invalid structured output remain errors and do not create a request.

Errors: 401 unknown/missing employee; 400 invalid draft or clarification required; 503 missing credentials or Gemini quota exhaustion; 502 provider failure, timeout, blocked/incomplete response or invalid output. None of these review failures creates a request. The frontend retains the draft. Keys and raw provider errors are not returned.

See [README](../README.md) for setup and [Week 4 delivery](week4-production-ai.md) for the evaluation plan and known limitations.

Gemini timeout handling: provider calls allow up to 60 seconds. A timeout returns HTTP 504 with a clear message and preserves the draft. Other invalid/provider responses remain 502; quota errors remain 503.
