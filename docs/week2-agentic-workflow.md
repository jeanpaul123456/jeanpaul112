# Week 2 — Engineering ownership

The bounded Week 2 behavior was request status transition management. The [original workflow record](../agentic-workflow.md) preserves that milestone. Later work added persistence, the frontend and AI without removing its lifecycle rules.

## Understand

Identify the sender, receiving department and current status before changing code. A valid transition depends on both the actor's membership and the current state. AI advice does not replace those conditions.

## Direct

Keep transition rules in the backend. The frontend displays the same progression, but a direct HTTP caller must receive the same denial. Keep status and history writes atomic. Make small changes in this existing repository so reviewers can inspect their purpose in Git history.

## Prove

`npm test` covers business rules. `npm run test:api` covers valid and invalid HTTP behavior with a real temporary database. `npm run test:e2e` proves submission, staff handling, notifications and failure recovery through the browser. `npm run eval:ai` evaluates the later AI boundary separately.

For the final handoff, the student must explain the rule, show one allowed and one denied action, and connect those behaviors to the tests. An assistant-generated change is not evidence by itself; executed checks and a demonstrated user journey are the evidence.
