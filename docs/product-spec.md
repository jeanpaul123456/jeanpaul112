# Product specification — final release

Employees need one place to ask IT, HR or Finance for help and see what happens next. The product replaces scattered calls and messages with a request that has an owner, destination, priority and visible history.

An employee enters a title and description, chooses a department and selects Low, Medium or High priority. Gemini reviews the draft for clarity, consistency and routing. If clarification is needed, the employee sees feedback under the description and can edit it. A valid submission becomes Submitted. AI does not accept work or mark it complete.

Only staff in the receiving department can accept, start, complete or reject that request. The sender can see the request and its history. Completion creates an in-app notification whose read state survives a reload. Rejection needs a reason. Completed and rejected requests cannot change state.

## Acceptance criteria

- A clear request can be submitted from the React frontend and remains after a restart.
- Invalid input and unknown identities are rejected before a record is created.
- A receiving department member can process work; another department cannot.
- Status history records the actor, time and note in the same transaction as the change.
- Ambiguous AI output or provider failure keeps the draft available and does not create a request.
- The release is usable from a remote URL with documented demo roles and no student laptop dependency.

## Scope

The final keeps one narrow service-request journey. Demo identities and fictional data are intentional. Enterprise login, attachments, email delivery, external company integrations, RAG and autonomous agents are outside this release. Hosting, health, logs and recovery evidence are required; unrelated product screens are not.

The [original Week 1 design](../product-spec.md) records the earlier exploration. This document describes what is implemented now. See [the API contract](api-contract.md) and [release operations](week5-release-operations.md) for the technical boundaries and remaining deployment work.
