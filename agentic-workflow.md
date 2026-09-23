Week 2 – Agentic Workflow

1. Week 1 Context

The Week 2 implementation is based on the Week 1 foundation of the
Internal Operations Service Hub.

The following documents were used:

product-spec.md
archetechtre.md (the architecture document; the filename is retained for compatibility)
data-model.md
decisions.md (ADR-001 is included in this file)

The implementation focuses on one bounded backend behavior: Request
Status Transition Management.

The purpose of this implementation is to verify that request status
changes follow the rules and requirements identified during Week 1.

2. Implementation Scope

The Week 2 milestone implements a NestJS backend endpoint responsible for
updating the status of a request.

The endpoint receives a new requested status and checks whether the
status change is allowed according to the request rules.

This milestone focuses only on this specific backend behavior and does
not implement the complete application.

Non-goals

Frontend
Real database
Production authentication
Complete Role-Based Access Control
Notifications
Attachments
Advanced analytics

For this milestone, in-memory data can be used instead of a real
database.

3. Request Lifecycle

According to the Week 1 product specification, a request can have the
following statuses:

Submitted
Assigned
In Progress
Completed
Rejected

For this implementation, the normal request lifecycle is:

Submitted → Assigned → In Progress → Completed

A request may also be rejected when it does not meet the required
conditions.

4. Transition Rules

The system should only accept valid request status changes.

The main valid transitions are:

Submitted → Assigned
Assigned → In Progress
In Progress → Completed

A request can also be rejected when necessary.

Invalid transitions should be rejected.

For example:

Submitted → Completed
Assigned → Completed
Completed → In Progress

5. Invariant

The implementation preserves the rules identified in the Week 1 data
model.

Every request must have a valid status.

A request cannot have an unknown or undefined status.

Requests can only move through permitted status transitions.

Once a request is completed, it cannot return to a previous state.

For example, a request should not move directly from Submitted to
Completed. It must first follow the required process through Assigned and In
Progress.

Also, once a request is completed, it cannot return to In Progress.

6. Verification Cases

The backend will be tested using valid and invalid status changes.

Valid Case 1

Current status: Submitted

Requested status: Assigned

Expected result: Accepted

Valid Case 2

Current status: Assigned

Requested status: In Progress

Expected result: Accepted

Invalid Case 1

Current status: Submitted

Requested status: Completed

Expected result: Rejected

The request status should remain unchanged.

Invalid Case 2

Current status: Completed

Requested status: In Progress

Expected result: Rejected

The request status should remain unchanged.

7. Agentic Workflow

The implementation is intentionally limited to Request Status Transition
Management.

Before starting the implementation, the Week 1 documents were reviewed to
identify:

Request statuses
Request rules
Business requirements
Invariants
Backend responsibilities
Features that are outside the scope of Week 2

The implementation should remain focused on the selected backend
behavior.

8. Direction and Control

The AI workflow follows three possible actions.

Approve

Continue with the implementation when the proposed solution follows the
Week 1 design and respects the request rules.

Redirect

Change the implementation if the solution adds unnecessary features or
does not follow the request status rules.

Stop

Stop the implementation if it introduces unrelated features or violates
the requirements and invariants defined in Week 1.

9. Proof Requirements

The implementation must demonstrate the following results:

Valid Case 1: Submitted → Assigned — Accepted
Valid Case 2: Assigned → In Progress — Accepted
Invalid Case 1: Submitted → Completed — Rejected
Invalid Case 2: Completed → In Progress — Rejected

The evidence should show:

The expected behavior
The actual behavior
Successful valid transitions
Rejected invalid transitions
The request status remaining unchanged after an invalid transition

10. Completion Criteria

The Week 2 milestone is complete when:

A NestJS backend endpoint exists for updating the request status.
Valid status transitions are accepted.
Invalid status transitions are rejected.
The Week 1 rules and invariants are preserved.
The verification cases can be reproduced.
The changes are committed to the existing public GitHub repository.