import { prisma } from '@/lib/prisma';

/**
 * Records a privileged action in the audit trail. Fire-and-forget:
 * audit failures must never break the user-facing operation.
 */
export async function logAudit(entry: {
  workspaceId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: entry.workspaceId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? undefined) as object | undefined,
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
