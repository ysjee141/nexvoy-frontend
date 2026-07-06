import { deleteAllTripDocumentNamespaces } from './indexedDbStore'
import { loadGuestPromotionMarkers, removeGuestPromotionMarker } from './ownerNamespace'

export async function clearAllLocalFirstDocuments(): Promise<void> {
  await deleteAllTripDocumentNamespaces()
  for (const marker of loadGuestPromotionMarkers()) {
    removeGuestPromotionMarker(marker.documentId)
  }
}
