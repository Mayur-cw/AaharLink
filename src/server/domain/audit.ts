import type { AuditEventRecord } from '../repository.js';
import type { RedactedAuditEvent } from '../../shared/contracts.js';
import { repository } from '../repository.js';

export function toRedactedAuditEvent(event: AuditEventRecord): RedactedAuditEvent {
  return {
    id: event.id,
    correlationId: event.correlationId,
    actorRole: event.actorRole,
    entityType: event.entityType,
    entityId: event.entityId,
    eventType: event.eventType,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    reason: event.reason,
    occurredAtUtc: event.occurredAtUtc,
  };
}

export function getEntityAuditTrail(entityType: string, entityId: string, limit: number = 50): RedactedAuditEvent[] {
  const result = repository.listAuditEvents(limit, undefined, entityType, entityId);
  return result.items.map(toRedactedAuditEvent);
}
