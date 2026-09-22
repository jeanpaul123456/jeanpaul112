> This document records the original product design. For the implemented request flow and AI extension, see [README](README.md), [the current API contract](docs/api-contract.md), and [Week 4 delivery](docs/week4-production-ai.md). The executable database schema is [backend/prisma/schema.prisma](backend/prisma/schema.prisma).

 Domain

## Important Entities

### Employee

An Employee is a person who uses the Internal Operations Service Hub to submit requests and receive services from different departments.

Some employees can also be members of a department staff team. These employees have additional permissions that allow them to manage and respond to requests.

**Example:**
An employee from the Finance department can submit a request to the IT department if they have a technical problem. If that employee is also part of the IT staff, they can handle IT requests submitted by other employees.

**In short:**
All department staff members are employees, but not all employees are department staff.

### Department Staff

Department Staff are employees who work within a specific department and have permission to manage requests assigned to that department.

They can review requests, update their status, and work on requests related to their department.

### Department

A Department is an organizational unit that is responsible for receiving and handling specific types of requests.

Examples include:

* IT
* Finance
* Human Resources (HR)

### Request

A Request is a service or help request created by an employee through the service hub.

Each request contains information about the employee who created it, the department responsible for it, and its current status.

---

# Relationships + Cardinality

## Relations and Cardinality

### 1. Employee → Request

**One Employee can create many Requests.**
**Each Request is created by one Employee.**

An employee may submit multiple requests, while every request has one employee who created it.

### 2. Department → Request

**One Department can manage many Requests.**
**Each Request is assigned to one Department.**

A department can receive and handle multiple requests, but each request is directed to one responsible department.

### 3. Department → Department Staff

**One Department can contain many Department Staff members.**
**Each Department Staff member belongs to one Department.**

Department staff members are employees who are assigned to a department and have the required permissions to manage its requests.

**Important:**
Department Staff and Department are not the same thing.

A department is the organizational unit, while department staff are the employees working in that department and handling its requests.

---

# Ownership

* Each request is created by one employee.
* Each request is assigned to one department.
* Department staff handle requests on behalf of their department.
* Employees can submit requests to departments even if they are not department staff.
* Department staff can handle requests assigned to their department.
* Department staff can also create requests when they need assistance from another department.

---

# Lifecycle + Rules

## State Transitions

### Assigned

The request has been sent to the department responsible for processing it.

The `Assigned` state only indicates that the responsible department has been selected. It does **not** mean that a particular department staff member has been selected to work on the request.

Requests must follow the defined states and cannot move randomly between statuses.

---

## Invariants

The system must always respect the following rules:

* Every request must contain a valid status.
* A request cannot have an unknown or undefined status.
* Once a request is completed, it cannot return to a previous state.
* Requests can only move through permitted state transitions.
* Every request must be connected to a valid employee.
* Every request must be connected to a valid department.

---

# Authorization + Sensitive Rules

Access to the system depends on the user's permissions.

* Employees can create requests and access the requests they are allowed to view.
* Department staff can manage requests related to their department.
* Staff members can update requests only when they have the required authorization.
* Users cannot access requests that they are not permitted to see.
* Users cannot access restricted information belonging to other departments.
* Only authorized department staff can perform department-specific management actions.

---

# Storage

## Relational / Document Reasoning

A **relational database** is the preferred storage solution because the Internal Operations Service Hub contains several connected entities, including employees, departments, department staff, and requests.

The relationships between these entities are important for the system. For example, the system needs to connect each request with the employee who created it and the department responsible for handling it.

A relational database makes it easier to:

* Connect employees with their requests.
* Retrieve requests belonging to a department.
* Manage department staff.
* Track request statuses.
* Maintain consistent relationships between the different entities.

A document database could provide greater flexibility in the structure of the data. However, this flexibility is not necessary for the current system.

Since the system depends more on structured relationships and data consistency, a **relational database is more suitable than a document database**.

---

# Durable vs Derived Data

## Durable Data

The following information needs to be stored permanently:

* Employee information
* Department information
* Department staff information
* Request information
* Request status
* Request creation date
* Request update information
* Request history

This data should remain available even after temporary system problems or failures.

## Derived Data

Some information can be calculated from the stored data whenever it is needed.

Examples include:

* Total requests created by an employee
* Total requests received by a department
* Number of pending requests
* Number of completed requests
* Number of requests currently assigned to a department

This information does not necessarily need to be stored because it can be calculated from the existing request data.

---

# Access

## Important Queries / Access Patterns

### Important Queries

The main queries required by the system include:

1. View all requests created by an employee.
2. View pending requests for a department.
3. Check the current status of a request.
4. Retrieve a specific request.
5. View the history of a request.
6. Retrieve requests assigned to a specific department.

### Access Patterns

```text
employee_id → requests

department_id + status → requests

status → requests

request_id → request

request_id → request history
```

These access patterns represent the main ways the application will search and retrieve request information.

---

# Indexes Only When Justified

An index can be added to `department_id` because the system will frequently need to retrieve requests belonging to a particular department, such as IT, Finance, or HR.

For example:

```text
department_id → requests
```

When the number of requests increases, this index can help the database locate requests for a specific department more efficiently instead of scanning all request records.

Other indexes should only be introduced when they are supported by actual access patterns or when they are needed to improve system performance.
