import type { EntityId, TombstoneEntityType, TombstoneNode, TripDocumentV1 } from './documentModel'

export function isTombstoned(
  document: TripDocumentV1,
  entityType: TombstoneEntityType,
  entityId: EntityId,
): boolean {
  return Object.values(document.tombstones).some(
    (tombstone) => tombstone.entityType === entityType && tombstone.entityId === entityId,
  )
}

export function filterActiveNodes<T extends { id: EntityId }>(
  nodes: Record<EntityId, T>,
  tombstones: Record<EntityId, TombstoneNode>,
  entityType: TombstoneEntityType,
): T[] {
  const deletedIds = new Set(
    Object.values(tombstones)
      .filter((tombstone) => tombstone.entityType === entityType)
      .map((tombstone) => tombstone.entityId),
  )

  return Object.values(nodes).filter((node) => !deletedIds.has(node.id))
}
