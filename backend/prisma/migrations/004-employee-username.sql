ALTER TABLE "Employee" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "Employee_username_key" ON "Employee"("username");
