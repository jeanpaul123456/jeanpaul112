# Data model

Employee demo login uses a nullable unique `Employee.username` added by migration `004-employee-username`. Seed supplies matching Gmail-formatted email/username pairs for the four employees. `LoginSession` stores a hashed random token, employee foreign key and expiry. The earlier `EmployeeCredential` table remains for migration compatibility but password hashes are no longer used. Requests and memberships retain their existing employee IDs.

The executable source is [schema.prisma](../backend/prisma/schema.prisma). Both local SQLite and the remote libSQL database use the same product tables.

| Entity | Responsibility |
|---|---|
| Employee | Employee identity, display name and unique login email |
| Department | Stable ID, unique slug and displayed name |
| DepartmentMembership | Composite employee/department membership used for authorization |
| ServiceRequest | Unique ticket number, title, description, priority, sender, receiving department, status, timestamps and optional unique idempotency key/payload fingerprint |
| RequestStatusHistory | Previous/new status, actor, time and optional note for each change |
| RequestCounter | Transactional ticket-number sequence |

Each request belongs to one sender and one receiving department. Employees may hold department memberships while also submitting their own requests. Status is Submitted → Assigned → In Progress → Completed; active states may instead become Rejected. The UI displays Assigned as Accepted. Priority is Low, Medium or High.

`completedAt` supports completion notifications; `completionReadAt` persists the sender's acknowledgment. Foreign keys protect relationships. Unique keys protect ticket numbers and department slugs. Indexes support the sender's list, department inbox and history lookup.

The deployment script adds a separate `HubMigration` metadata table to record baseline and forward-migration checksums. It is operational metadata, not a user-facing product entity. Request data is preserved by seeding and repeated deployments. Migration `002-idempotency` adds nullable request-key fields and a unique index without changing the deployed baseline. See [release operations](week5-release-operations.md) for migration restrictions.
