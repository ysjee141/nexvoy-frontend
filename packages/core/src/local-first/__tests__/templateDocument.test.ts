import {
  applyTemplateDocumentUpdate,
  createEmptyTemplateDocumentV1,
  createYjsTemplateDocument,
  encodeTemplateDocumentUpdate,
  mutateTemplateDocumentInYjs,
  readTemplateDocumentFromYjs,
} from '../templateDocument'

const template = createEmptyTemplateDocumentV1({
  id: 'template-1',
  ownerId: 'user-1',
  title: 'Summer packing',
  createdAt: '2026-07-14T00:00:00.000Z',
})

const doc = createYjsTemplateDocument(template)

mutateTemplateDocumentInYjs(doc, (draft) => {
  draft.items['item-1'] = {
    id: 'item-1',
    templateId: 'template-1',
    name: 'Passport',
    categoryName: 'Documents',
    isPrivate: false,
    sortOrder: 0,
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  }
})

const update = encodeTemplateDocumentUpdate(doc)
const restoredDoc = createYjsTemplateDocument()
applyTemplateDocumentUpdate(restoredDoc, update)

const restored = readTemplateDocumentFromYjs(restoredDoc)
if (restored?.items['item-1']?.name !== 'Passport') {
  throw new Error('Yjs Template document update should restore template item data.')
}
