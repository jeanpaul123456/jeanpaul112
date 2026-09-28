# Live verification — September 28, 2026

App: https://jeanpaul112.onrender.com/app/

Observed release: `5c815c2246329c8dce34e0c12fc60e4e6a66d71d`.

The read-only `npm run smoke -- https://jeanpaul112.onrender.com` check passed at 11:41 UTC. `/app/`, `/health`, `/health/ready` and `/directory` each returned HTTP 200. Readiness reported database `ok` and review mode `gemini`.

## Browser journey

The live browser used the normal UI without mocked provider responses. Charbel submitted a clearly labeled fictional laptop problem to IT with High priority. The live AI check accepted it and the backend created `REQ-1001` as Submitted.

An API attempt by HR employee-2 to accept this IT ticket returned 403. An empty draft sent to `/ai/submit-request` returned 400. Jean-Paul then used the frontend to accept the valid ticket, start work and complete it. Each transition appeared in the visible history with its actor and note. The completion note explicitly describes a fictional test; no real equipment was changed.

Charbel received an unread completion notification. Opening it marked it read. After reloading the page and selecting Charbel again, the request was still Completed and the notification still Read. The fictional record was retained as evidence.

## Controlled failure and recovery

The drill used application revision 9572674c3872634ec2c4f529eab551cb395a20b5. We changed only GEMINI_MODEL to release-drill-invalid-model and deployed the same code. API keys were not changed or exposed.

A fictional draft titled “Recovery drill 28 Sep: laptop will not start” failed with the visible provider error. The browser retained its title, description, department and priority and enabled retry. A database-backed request listing contained only REQ-1001: the failed attempt created no ticket.

Render logs recorded POST /ai/submit-request at September 28 19:07:29 Beirut time (16:07:29 UTC): HTTP 502, duration 790 ms, request ID 8c9622dc-b2c3-4dae-a44a-90162fe0cfbb.

The first attempt to restore the masked environment field retained the invalid value. We inspected the saved non-secret model name, corrected the visible field to gemini-3.1-flash-lite and redeployed. Successful restoration deployment: dep-dat929l9fdbs7386gj6g. No rollback to the invalid configuration is required or appropriate.

Retrying the same preserved draft succeeded. Render logged HTTP 201 at 19:10:54 Beirut time (16:10:54 UTC), duration 39,985 ms, request ID 382cd4a1-e494-42bb-bafa-7e5e4a264431. The app created REQ-1002 as Submitted. Jean-Paul accepted it, started work and completed it in the frontend. Charbel received its unread completion notification. REQ-1001 remained Completed and its earlier notification remained Read after the service redeployments.

Post-recovery smoke passed at 16:10:33 UTC: /app/, /health, /health/ready and /directory each returned 200. This health check preceded the successful submission response; the subsequent UI journey established live AI recovery too.

## Decision and limits

GO for the tested teaching-demo application. Both test tickets are fictional and retained as evidence. Recovery is proven for a provider/model-configuration failure, not every possible outage. The recovered AI call took about 40 seconds, so free-provider latency remains a limitation. Demo identity, quota/cold-start limits and lack of submission idempotency remain as documented in Week 5. Final submission must match the actual deployed commit after these documentation-only updates.
