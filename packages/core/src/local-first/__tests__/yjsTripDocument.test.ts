import { SAMPLE_TRIP_DOCUMENT_V1 } from '../tripDocument'
import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  encodeTripDocumentUpdate,
  mutateTripDocumentInYjs,
  readTripDocumentFromYjs,
} from '../yjsTripDocument'

const doc = createYjsTripDocument(SAMPLE_TRIP_DOCUMENT_V1)

mutateTripDocumentInYjs(doc, (tripDocument) => {
  tripDocument.checklists['checklist-1'] = {
    id: 'checklist-1',
    title: 'Packing',
    createdAt: '2026-06-29T00:00:00.000Z',
  }
})

const update = encodeTripDocumentUpdate(doc)
const restoredDoc = createYjsTripDocument()
applyTripDocumentUpdate(restoredDoc, update)

const restored = readTripDocumentFromYjs(restoredDoc)
if (restored?.checklists['checklist-1']?.title !== 'Packing') {
  throw new Error('Yjs Trip document update should restore checklist data.')
}
