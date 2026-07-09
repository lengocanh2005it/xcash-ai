export interface CreateAuditLogData {
  tenantId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

/**
 * Minimal client interface — accepts both PrismaClient and transaction client (`tx`).
 */
interface AuditLogCreator {
  auditLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

/**
 * Ghi audit log — dùng chung cho toàn backend.
 * Nhận vào PrismaClient hoặc Prisma transaction client (`tx`).
 *
 * @example Trong transaction callback:
 * ```ts
 * await this.prisma.$transaction(async (tx) => {
 *   // ... business logic ...
 *   await createAuditLog(tx, { tenantId, entityType: '...', ... });
 * });
 * ```
 *
 * @example Direct call:
 * ```ts
 * await createAuditLog(this.prisma, { tenantId, entityType: '...', ... });
 * ```
 */
export async function createAuditLog(
  client: AuditLogCreator,
  data: CreateAuditLogData,
): Promise<void> {
  await client.auditLog.create({
    data: {
      ...(data.tenantId != null ? { tenantId: data.tenantId } : {}),
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      actor: data.actor,
      ...(data.beforeState != null ? { beforeState: data.beforeState } : {}),
      ...(data.afterState != null ? { afterState: data.afterState } : {}),
    },
  });
}
