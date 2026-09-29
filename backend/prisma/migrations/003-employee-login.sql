CREATE TABLE "EmployeeCredential" (
  "employeeId" TEXT NOT NULL PRIMARY KEY REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "passwordHash" TEXT NOT NULL
);
CREATE TABLE "LoginSession" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" DATETIME NOT NULL
);
CREATE INDEX "LoginSession_employeeId_idx" ON "LoginSession"("employeeId");
