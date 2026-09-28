# Live verification — September 28, 2026

App: https://jeanpaul112.onrender.com/app/

Observed release: `5c815c2246329c8dce34e0c12fc60e4e6a66d71d`.

The read-only `npm run smoke -- https://jeanpaul112.onrender.com` check passed at 11:41 UTC. `/app/`, `/health`, `/health/ready` and `/directory` each returned HTTP 200. Readiness reported database `ok` and review mode `gemini`.

## Browser journey

The live browser used the normal UI without mocked provider responses. Charbel submitted a clearly labeled fictional laptop problem to IT with High priority. The live AI check accepted it and the backend created `REQ-1001` as Submitted.

An API attempt by HR employee-2 to accept this IT ticket returned 403. An empty draft sent to `/ai/submit-request` returned 400. Jean-Paul then used the frontend to accept the valid ticket, start work and complete it. Each transition appeared in the visible history with its actor and note. The completion note explicitly describes a fictional test; no real equipment was changed.

Charbel received an unread completion notification. Opening it marked it read. After reloading the page and selecting Charbel again, the request was still Completed and the notification still Read. The fictional record was retained as evidence.

## Limits and next checks

No server restart was performed. No provider secret was changed and no remote outage/recovery exercise was performed. Browser reload persistence does not establish restart durability. The final GO decision remains pending those checks and the final deployed/submitted commit match.
