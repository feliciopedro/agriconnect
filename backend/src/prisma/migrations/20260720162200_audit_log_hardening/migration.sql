-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "previousHash" TEXT,
ADD COLUMN "hash" TEXT;

-- AlterTable
ALTER TABLE "UssdAuditLog" ADD COLUMN "previousHash" TEXT,
ADD COLUMN "hash" TEXT;

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorId_fkey";

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Database Triggers to enforce Append-Only Immutability on AuditLog tables
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable append-only records. UPDATE or DELETE operations are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mod ON "AuditLog";
CREATE TRIGGER trg_prevent_audit_log_mod
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_prevent_ussd_audit_log_mod ON "UssdAuditLog";
CREATE TRIGGER trg_prevent_ussd_audit_log_mod
BEFORE UPDATE OR DELETE ON "UssdAuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
