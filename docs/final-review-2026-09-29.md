# Independent final review — September 29, 2026

**Historical review:** this record describes the application before the later email/password login change. The login update passed 79 deterministic tests and 8 AI evaluations locally, but needs hosted credential configuration, deployment and a new authenticated live journey. See the current README and release-gate report. The live sign-off below must not be used as proof that the login version is already deployed.

Reviewed the changes since `528c94c` through `9f3d3d09a29631acf33397cff10b2a70a54a67c9` and compared the repository with all 13 supplied final-capstone images and the Week 4 intake requirements. This is a verification record, not a guarantee that every possible input or outage has been tested.

## What changed

- Submission retries now reuse a draft key. The backend stores the key and a normalized payload hash, returns the original ticket on a matching retry, and rejects conflicting content with 409. A replay avoids another AI call.
- A forward-only SQL migration adds those fields without replacing the checksum-protected baseline.
- Gemini retries a temporary HTTP 503 once. It still reports provider failure without silently switching to local rules.
- API and browser tests cover lost responses after a committed request, replay, conflicting payloads and migration checksums.
- Release evidence and setup instructions were expanded.

## Checks performed

| Check | Result |
|---|---|
| Backend and frontend builds | Passed |
| Unit tests | 27 passed |
| API/database integration tests | 42 passed |
| Browser E2E tests, Microsoft Edge | 5 passed |
| Backend lint | Passed |
| AI evaluation | 8/8 passed: six live Gemini cases and two injected failure cases |
| Live HTTP smoke | `/app/`, `/health`, `/health/ready`, `/directory`: all 200 |
| Live release identity | `9f3d3d09a29631acf33397cff10b2a70a54a67c9`, database `ok`, mode `gemini` |
| Live browser journey | REQ-1004: Charbel submitted through Gemini; Jean-Paul accepted, started and completed it; Charbel received its completion notification |
| Live boundaries | HR action against IT ticket: 403. Empty AI submission: 400 |
| Existing data after deployment | REQ-1001, REQ-1002 and REQ-1003 remained visible; older completion notification read state remained visible |
| Browser reload persistence | REQ-1004 remained Completed and its notification remained Read after reloading and selecting the requester again |

The release gate finished at September 28 22:41 UTC, which is September 29 01:41 Beirut time. Reports retain UTC timestamps. The working tree was clean before the run. The gate reports `workingTreeChanged: true` because it checks after generated build/evaluation files change; no application source edits were made during testing. Lint was run separately, not as part of the gate command.

The live migration was exercised by the updated application's successful request creation and reads of existing requests. Its migration receipt was not independently queried. No fresh service restart or deliberate provider outage was performed in this review; the September 28 remote failure/recovery record remains historical evidence for revision `9572674`, not a new test on `9f3d3d0`.

## Match with the professor's photos

| Required area | Evidence and assessment |
|---|---|
| Same repository, focused Operations Hub | Existing repository retained; no separate project or unnecessary scope added |
| Week 1 design | Product specification, architecture, data model and ADR-001 are present |
| Week 2 ownership | Agentic workflow document and meaningful Git history are present; Jean-Paul must explain the decisions himself |
| Week 3 full stack | React, NestJS, real persistence, explicit contract, authorization, validation, failure handling and regression checks |
| Week 4 runtime AI | Bounded draft/catalog context, structured candidate, backend validation, staff authority, eight repeatable evaluation cases |
| Week 5 operations | Remote app, configuration examples, health, request logs, release gate, smoke and recorded failure/recovery procedure and evidence |
| New user/engineer/operator handoff | README links the live demo, roles, setup, commands and operations documents |
| Submission and defense | Correct subject, four recipients, name, repository, live URL and roles documented; final SHA must be frozen and email sent by the student |

## Findings and corrections

1. README and release documents still said the candidate was not deployed. The current health endpoint proves it is deployed. Updated the handoff to distinguish the tested application from the documentation changes still awaiting commit/push.
2. The API contract named Gemini 3.5 and described an automatic deterministic fallback. The code defaults to Gemini 3.1 Flash-Lite and returns errors on provider failure. Corrected the contract and an outdated fallback sentence in the Week 4 document.
3. The Week 5 evidence table linked the latest report while describing the old 71-test run. Updated it to the current 74-test result.

No application-blocking failure was reproduced in these checks. The new idempotency behavior is covered for sequential retries and a lost response; simultaneous duplicate submissions and browsers with unavailable session storage were not independently tested. The migration test checks repeat application/checksum rejection, but is not a full production rollback exercise.

## Remaining handoff

Commit and push this review, the corrected documents and refreshed test reports. Verify the resulting deployed SHA and run smoke again. Use that full SHA in the submission email, keep the live app reachable through the defense, and rehearse the 15-minute explanation. Deadline: September 30, 2026, 12:00 PM Beirut time.

The application is a public teaching demo with selectable identities, not production authentication. AI can misclassify drafts and free provider/hosting quotas can interrupt access. These limitations are documented and do not require adding enterprise features that the slides explicitly exclude.
