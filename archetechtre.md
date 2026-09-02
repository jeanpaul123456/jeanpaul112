# Internal Operations Service Hub - Architecture

## Purpose + Scope

### Requirement Driving the Design

Employees need a simple way to create and track requests for assistance from the appropriate department.

The architecture is designed to support request submission, request processing, authorization, and communication between employees and department staff.

---

# Structure + Flow

### Architecture Diagram

The system follows a simple centralized architecture:

**App / Web → Backend → Persistent Storage**

The App / Web communicates with the Backend, while the Backend is responsible for processing requests and communicating with the database.

## Components + Responsibilities

### App / Web

* Provides the interface used by employees and department staff.
* Collects the information required to create a request.
* Sends user actions and requests to the Backend.
* Displays request information and statuses.
* Shows success or error messages to users.

### Backend

* Authenticates users.
* Checks user permissions and roles.
* Validates information received from the App / Web.
* Creates and manages requests.
* Determines the department responsible for a request.
* Communicates with Persistent Storage.
* Returns the appropriate result to the App / Web.

### Persistent Storage

* Stores employee information.
* Stores department information.
* Stores department staff information.
* Stores submitted requests.
* Stores request statuses and history.
* Provides the Backend with the information needed for authentication and authorization.
* Keeps important system data available after it has been successfully saved.

---

# Dependencies

## Internal Dependencies

* The App / Web relies on the Backend to process user actions.
* The Backend relies on Persistent Storage to save and retrieve system data.

## External Dependencies

No external dependencies are currently required by the known project requirements.

An external identity provider, such as Keycloak, could be introduced later if the system requires centralized authentication or external identity management.

For v0.1, authentication is kept inside the system to avoid adding unnecessary external dependencies before they are justified.

---

# Trust + Resilience

Information received from the App / Web should not be considered trusted by default.

The Backend must validate incoming information and verify that users have permission to perform requested actions before processing them.

## Failure Scenarios

* **Persistent Storage unavailable:** The Backend cannot read or save request information and should return an appropriate failure response to the App / Web.
* **Backend unavailable:** The App / Web cannot complete operations and should inform the user that the request could not be processed.
* **Invalid request information:** The Backend rejects the request and returns an error instead of storing invalid data.
* **Unauthorized action:** The Backend rejects the operation when the user does not have the required permission.

---

# Scalability + Reliability

The expected number of employees, requests per day, and system traffic are not currently known.

Because the expected workload is still uncertain, introducing additional infrastructure such as Redis, message queues, or multiple microservices is not necessary for the initial version.

The centralized architecture keeps the system easier to develop, test, and maintain.

As real usage and performance requirements become clearer, the architecture can be reviewed and expanded if needed.

---

# Decisions

## Communication Decision

The App / Web communicates with the Backend using a **request-response approach**.

The client sends a request when it needs to perform an operation or retrieve information, and the Backend returns the result.

Real-time communication through WebSockets is not included because the current requirements do not require instant updates.

If request status needs to be refreshed automatically, polling can be used to retrieve the latest status from the Backend.

---

## Major Decision

We chose a **simple centralized architecture** for v0.1 because the expected system load is currently unknown and the architecture is sufficient for the existing requirements.

The system consists of:

```text
App / Web
     ↓
 Backend
     ↓
Persistent Storage
```

This approach reduces unnecessary complexity and makes the system easier to modify while the requirements are still evolving.

If future requirements show a need for higher scalability, better performance, or additional reliability, external services or additional Backend components can be introduced.

These additions should only be made when there is a clear requirement for them.

### Actor and Access Consideration

The architecture distinguishes between regular employees and department staff.

Regular employees can submit and track their own requests, but they should not have access to all requests in the system.

Department staff members have additional permissions because they are responsible for handling requests related to their department.

Therefore, department staff are treated as authorized users with department-specific access rather than giving all employees access to every request.
