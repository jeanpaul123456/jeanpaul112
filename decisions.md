# ADR-001: Use a Centralized Architecture for v0.1

## Problem

The system needs to allow employees to submit and track internal requests, while department staff are responsible for handling requests assigned to their departments.

At the current stage of the project, the expected number of users, daily requests, and system traffic are not known.

Since the future workload is uncertain, using a distributed architecture such as microservices or message queues from the beginning could introduce complexity that is not currently necessary.

The architecture should therefore remain simple and easy to maintain until the system requirements become clearer.

---

## Options

### Option 1: Simple Centralized Architecture

Use one App/Web application connected to a single Backend, with the Backend communicating with persistent storage.

**Advantages:**

* Simple to develop and maintain.
* Satisfies the current system requirements.
* Requires fewer components.
* Easier to test and troubleshoot.
* Makes future changes easier while the requirements are still evolving.

### Option 2: Distributed Architecture

Use multiple independent components from the beginning, such as microservices, message queues, Redis, or other external services.

**Advantages:**

* Individual components can be scaled independently.
* Suitable for systems with large workloads.
* Can provide better support for future scalability requirements.

**Disadvantages:**

* Increases development and maintenance complexity.
* Requires additional infrastructure.
* Introduces more dependencies between components.
* The current requirements do not justify this approach.

---

## Decision

For **v0.1**, we will use a **simple centralized architecture**.

The App/Web will communicate directly with the Backend, and the Backend will communicate with persistent storage.

Additional distributed components will not be introduced at this stage because they are not required by the current system.

If the number of users, requests, or performance requirements increases significantly, the architecture can be reconsidered and expanded.

---

## Consequences

### Positive

* The initial system remains simple.
* Development and testing are easier.
* Maintenance is less complicated.
* There are fewer components and dependencies.
* The architecture is appropriate for the current requirements.

### Negative

* Components cannot be scaled independently as easily as with a distributed architecture.
* The Backend could become a limitation if the system grows significantly.
* Future architectural changes may be required if the system experiences much higher traffic.

### Future Consideration

When more information becomes available about the number of users, request volume, performance, and scalability needs, this decision should be reviewed.

If the centralized architecture is no longer sufficient, additional solutions such as caching, message queues, or separate services can be introduced based on actual system requirements.

# ADR-002: Keep AI advisory during request intake

## Decision

Gemini reviews the draft when the employee sends it. The backend supplies the department catalog, validates the structured response, and returns concerns or corrections for the employee to review. A passing request is created as Submitted. Department staff must still accept it, start work and complete it.

## Reason

A clear request does not mean that a department has accepted responsibility or started working. AI should help with wording and routing while existing software rules and department staff keep control of the workflow.

## Consequences

Provider failures preserve the draft and do not create a request unless the controller can safely apply its deterministic Gemini fallback. That fallback does not call another provider and cannot silently submit a request. Model mistakes can still cause unnecessary clarification. Local rule-based checking remains an explicit offline option; it is not represented as AI. The legacy manual submission API remains available.

The implementation and remaining semantic evaluation work are described in [Week 4 delivery](docs/week4-production-ai.md).
