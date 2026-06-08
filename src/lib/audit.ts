import type { PrismaClient, EntityType, AuditAction, AuditSource } from "@/generated/prisma/client";

interface AuditEntry {
  userId: string;
  entityType: EntityType;
  entityId: string;
  orderItemId?: string;
  action: AuditAction;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  source?: AuditSource;
}

export function writeAuditLog(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  entry: AuditEntry
) {
  return tx.auditLog.create({
    data: {
      userId: entry.userId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      orderItemId: entry.orderItemId,
      action: entry.action,
      fieldName: entry.fieldName,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      source: entry.source ?? "UI",
    },
  });
}
