# Week 5 — Release and operations

## Release status

### Current working-tree delta — pending deployment

The September 28 idempotency change and forward migration `002-idempotency` are now pushed to `origin/master` but are not deployed. The credential-safe local checks passed: both builds, 25 unit, 42 API/database and 5 browser tests, plus backend lint. The live-AI release gate was deliberately not run because the configured key has been exposed; rotate it before running provider evaluations. A read-only smoke at 17:01:55 UTC returned HTTP 200 for `/app/`, `/health`, `/health/ready` and `/directory`; `/health` reported release `528c94c086ddd0398fc6f6de4f9e3b0ab4a6e84c`, matching the old local `HEAD` at that time. That smoke proves only that the prior deployment was reachable—not that the idempotency code or migration is live. **The pushed candidate remains NO-GO for final submission until the rotated-key release gate passes, it is deployed, the migration is verified, and the live smoke test plus critical browser journey pass on that exact SHA.**

The application is prepared for a single Render web service with a separate Turso/libSQL database. React is served by NestJS at `/app/`, so the browser and API share one origin. Local development still uses SQLite.

September 26 verification: 25 unit, 41 API/database and 5 browser tests passed across the checks for this change. Both builds passed. The first live evaluation with Gemini 3.5 Flash-Lite passed 6/8 because two calls timed out; [that report is retained](week5-ai-before-model-comparison.json). The same suite with Gemini 3.1 Flash-Lite passed 8/8, so the release configuration now uses 3.1 Flash-Lite. See [the latest report](week4-ai-eval-results.json). This comparison is evidence for the selected model, not a guarantee of future availability.

**Live app: [Service Hub](https://jeanpaul112.onrender.com/app/).** On September 28, `/health/ready` reported release `5c815c2246329c8dce34e0c12fc60e4e6a66d71d`, database `ok`, and review mode `gemini`. The browser journey passed using fictional ticket `REQ-1001`: live AI submission → IT acceptance → work started → completion → requester notification. An HR actor's attempt to accept the IT ticket returned 403. Completed state and notification read status survived a browser reload.

**Decision: GO for the teaching-demo application verified on September 28.** The controlled provider failure, restored submission, staff workflow and persistence through service redeployments passed on application revision `9572674`. The final submission must use the deployed commit containing these evidence updates. See [the live verification record](live-verification-2026-09-28.md).

## Deploy the same repository

1. Create a Turso database and obtain its `libsql://` URL and authentication token. Keep both in your private hosting settings; never paste tokens into GitHub or these documents. Use a new empty database for this release.
2. In Render, create a Blueprint from the existing public repository. It reads `render.yaml`. Choose the free service if staying within free hosting limits.
3. Supply `DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `GEMINI_API_KEY` as secret environment variables. The blueprint sets `REQUEST_REVIEW_MODE=gemini`, the model, Node version and `HOST=0.0.0.0`.
4. Deploy the intended commit. The build installs locked dependencies and builds both applications. Startup applies the baseline schema once and seeds demo identities without removing requests.
5. Open the Render service URL followed by `/app/`. The database must be remote: a SQLite file on the free web service is temporary and is not an acceptable persistence target.
6. Record the service URL and commit below. Keep automatic deploys disabled after choosing the submitted release.

`npm --prefix backend run db:deploy` requires a remote libSQL URL and token. It applies `backend/prisma/schema.sql` in a transaction and records its checksum, then applies each separately checksummed forward migration. Subsequent starts verify those checksums and preserve records. Changing the baseline or an applied migration is rejected; create a new migration instead. Do not use `db:setup` or `prisma db push` against the remote database.

The free service can sleep when idle; allow for a cold start before the defense. Free hosting and AI quotas can change. Review [Render's free-service limits](https://render.com/docs/free) and the selected database plan before deployment. No paid plan is required by the assignment.

## Configuration and access

| Setting | Purpose |
|---|---|
| `DATABASE_URL` | Local `file:./dev.db`, or durable remote `libsql://…` |
| `DATABASE_AUTH_TOKEN` | Remote database secret; not needed locally |
| `REQUEST_REVIEW_MODE` | `gemini` for final runtime AI; `local` is only an offline rule checker |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Private provider credential and selected model |
| `HOST`, `PORT` | Listen address and hosting-assigned port |
| `RENDER_GIT_COMMIT` / `RELEASE_SHA` | Release identity returned by health endpoints |

This is a public teaching demo. The employee selector is the documented demo identity mechanism, not password authentication. Anyone with the link can choose a demo role. The API still enforces request ownership, department membership and lifecycle rules for that identity. Use fictional requests only. Real employee data and company credentials do not belong here.

## Release gate

Install the test browser as described in the README, then run:

```sh
npm run release:gate
```

This runs build, unit, API/database and browser regression checks, followed by eight AI evaluations. A failure stops the gate and returns a nonzero exit code. Results are written to `docs/release-gate-results.json`. AI calls require the configured Gemini key and available quota. The report records the source commit and whether the working tree was changed. Commit the final source and record the exact deployed SHA; never present a dirty-tree run as proof of a different release.

After deployment:

```sh
npm run smoke -- https://YOUR-SERVICE.onrender.com
```

This read-only check verifies frontend HTML, health, database readiness and the directory. It does not claim a successful live AI call or replace the browser journey.

## Health and signals

- `GET /health`: process liveness and release SHA.
- `GET /health/ready`: product-table query, database readiness and configured review mode. Returns 503 when the database query fails. This does not call Gemini or consume quota.
- Render's health check uses `/health/ready`. See [Render health checks](https://render.com/docs/health-checks).
- Every completed HTTP request logs a JSON event with a generated request ID, method, route template, status and duration. The same ID is returned in `X-Request-Id`. Bodies, query strings, identity headers and API keys are excluded from these request logs.
- In the hosting log stream, investigate repeated 5xx responses, AI calls taking around 60 seconds, failed readiness checks and unexpected restarts. AI 503 suggests configuration/quota or provider unavailability; 504 indicates timeout; 502 indicates unusable output/upstream failure.

Use the provider dashboard's health and log stream during the defense. No independent alerting service is configured. An operator must inspect these signals; do not claim unattended alerting.

## Controlled failure and recovery on the remote target

Run this during a planned demo window, with fictional data and no other users working:

1. Record the deployed SHA and a successful `/health/ready` response. Create and complete an IT request from the browser; note its ticket number.
2. Record `GEMINI_MODEL`, temporarily set it to `release-drill-invalid-model`, and use Save and deploy for the same commit. Leave API keys unchanged.
3. Send a new clear request in the browser. Confirm an error, the draft remains available, and no new ticket appears. Save a redacted screenshot and matching request ID/status from logs. Database health can remain green: it does not measure provider availability.
4. Restore `GEMINI_MODEL=gemini-3.1-flash-lite`, verify the visible saved value, and redeploy the same commit. Retry from the browser. The request must be created as Submitted, then accepted, started and completed by the IT actor.
5. Switch back to the requester and verify the completion notification. Reload and confirm the earlier ticket and history survived both restarts. Capture health, release identity and the final request state.
6. Run the read-only smoke command again and record the result. Check the app from a separate browser session using only the README instructions.

If recovery fails, keep the decision NO-GO. Fix the cause and repeat the critical path; do not hide a failed run by substituting local checks. To roll back code, deploy the last known good commit using the same database. This initial schema does not have a destructive down migration. Before future schema changes, use a database backup and a tested forward migration.

## Evidence to complete after deployment

| Evidence | Current status |
|---|---|
| Public app URL | https://jeanpaul112.onrender.com/app/ — verified September 28 |
| Final deployed and submitted SHA | Recovery-tested application: `9572674c3872634ec2c4f529eab551cb395a20b5`; match the final documentation commit to `/health` before submission |
| Automated gate | Passed September 26: [dated report](release-gate-results.json), 71 deterministic tests + 8 AI cases; source changes were uncommitted during this run |
| Remote browser journey + authorization rejection | Passed September 28, fictional ticket REQ-1001; unauthorized HR action returned 403 |
| Record persistence across remote restart | Passed: REQ-1001 and its history survived the initial upgrade and the controlled configuration redeployments |
| Controlled provider failure + successful recovery | Passed: model unavailable → HTTP 502 with retained draft/no ticket → restored model → HTTP 201, REQ-1002 completed through UI |
| Post-recovery smoke | Passed September 28 at 16:10:33 UTC: frontend, health, readiness and directory all HTTP 200 |
| Final GO, time and remaining risks | GO for tested application after recovery on September 28; documented demo limitations below remain |

Remaining known limitations: demo identity can be impersonated; free services have cold starts and quotas; AI judgments vary. Submission retries are idempotent when the client reuses its key; older clients that omit the optional key do not get that guarantee. These are explicit teaching-demo limits, not claims of enterprise readiness.
