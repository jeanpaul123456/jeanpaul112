# Internal operations service hub

A company-internal platform designed to organize employee support requests and coordinate their handling across departments such as IT, Human Resources, and Finance.

## Problem / Context

### Context
- Employees currently use different communication channels to ask for internal assistance.
- Requests can be difficult to organize when they are spread across emails, messages, or verbal communication.
- Department employees need a clearer way to manage incoming work and follow its progress.

### Problem
- Employees do not have a single place to follow their support requests.
- Some requests may be overlooked or delayed.
- A request may reach the wrong department or employee.
- It may be unclear who is responsible for a request.
- Employees may not know the latest request status.
- Approval requirements may not be clear for certain requests.

## Confirmed Information

- The company requires a centralized platform for internal support requests.
- Employees must be able to create and submit requests through the platform.
- Department employees must be able to process and manage requests.
- Employees must be able to follow the progress of their requests.
- The platform is intended for internal departments such as IT, HR, and Finance.

## Actors / Stakeholders

### Actors
- Employees
- IT Personnel
- HR Personnel
- Finance Personnel
- Department Manager

### Stakeholders
- Department Managers
- Company Management
- Organization

## Functional Requirements

- Employees can create a support request and direct it to the relevant department.
- Employees can access a list of their own requests and view their current status.
- Department personnel can view and work on requests belonging to their department.
- Department personnel can access both active and previously completed requests for their department.
- Every request must have a clearly displayed current status, such as:
  - Submitted
  - Assigned
  - In Progress
  - Completed
  - Rejected
- The system should record important changes made to a request.
- Authorized department personnel should be able to update the status of requests they are responsible for.

## Non-Functional Requirements

### Security
- Users must authenticate before entering the system.
- Access to system functions must depend on the user's assigned role.

### Privacy
- Employees should only see requests and information that they are permitted to access.
- Department information should remain protected from unauthorized users.

### Performance
- Request pages and request details should load within an acceptable amount of time.
- Normal system activity should not cause noticeable delays for users.

### Availability
- The platform should remain accessible during normal company working hours.
- Planned maintenance should have as little impact on employees as possible.

### Status Freshness
- Changes made to a request should become visible to authorized users without unnecessary delay.

### Fault Tolerance
- If a secondary feature temporarily stops working, the main request-management functions should continue operating.
- A problem affecting one department should not bring down the complete platform.

### Capacity / Throughput
- The system should support the expected number of employees and daily requests without significant performance problems.

### Reliability / Data Integrity
- A successfully submitted request must not disappear because of a temporary system failure.
- Saved request information and status updates must remain stored after recovery from an error.

## Assumptions / Constraints / Unknowns

### Assumptions
- Every employee has an individual account.
- Users must log in before using the platform.
- Employees may submit more than one request.
- Requests are associated with a specific department.
- Different roles have different access rights.
- Department managers can monitor requests belonging to their department.
- A request can be rejected when it does not meet the required conditions.
- Each request has one active status at a time.

### Constraints
- The platform is intended only for internal company operations.
- Access must be controlled according to employee roles.
- Confidential information belonging to a department must not be exposed to unauthorized users.
- The platform is not intended to replace existing specialized departmental applications.

### Unknowns
- Should employees choose the department themselves, or should the platform automatically determine it from the request type?
- Should department personnel see every request for their department or only requests assigned to them?
- Can more than one staff member be assigned to the same request?
- Can a request be moved from one department to another?
- Should the employee be able to see the staff member currently handling the request?
- Can employees modify a request after submission?
- If editing is allowed, should it stop once processing has started?
- Should requests have priority levels?
- Who is responsible for assigning priority?
- Which requests need approval?
- How quickly should a status update appear to the employee?
- How long should completed requests remain accessible?
- Should old requests be archived?
- What is the expected number of users?
- What is the expected number of requests each day?
- What response-time target should the system meet?
- What availability target is required?

## Non-Goals

- The platform will not replace the company's specialized HR management software.
- The platform will not replace accounting or financial management applications.
- The platform will not replace technical monitoring or IT infrastructure tools.
- The platform will not provide live chat between employees and departments.
- The platform does not guarantee an immediate response to every submitted request.

## Acceptance Criteria

### Correct Behavior

- When an authenticated employee provides all required information, a new request is successfully created.
- The newly created request appears in the employee's personal request list.
- The request is routed to the selected or appropriate department.
- Authorized department staff can access and process the request.
- The employee can see the latest status of the request.
- Successfully saved requests remain available after a temporary system problem.

### Example Scenario: IT Support Request

Employee submits:

> "My laptop does not start."

Department:

> IT

Initial status:

> Submitted

IT staff receives and takes responsibility for the request.

Status:

> In Progress

After the laptop problem is resolved:

Status:

> Completed

The employee opens the request list and can see that the request has been completed.

### Incorrect Behavior

- If mandatory information is missing, the platform must prevent the request from being submitted.
- A user who has not authenticated must not be allowed to access protected system functions.
- A user attempting to open a request without the required permission must be denied access.
- If request creation fails, the system must not display the request as successfully submitted.
- Unauthorized users must not be able to view confidential departmental request information.
- A temporary failure must not cause already saved requests to be incorrectly deleted.

