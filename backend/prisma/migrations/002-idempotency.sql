ALTER TABLE "ServiceRequest" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "ServiceRequest" ADD COLUMN "idempotencyPayloadHash" TEXT;
CREATE UNIQUE INDEX "ServiceRequest_idempotencyKey_key" ON "ServiceRequest"("idempotencyKey");