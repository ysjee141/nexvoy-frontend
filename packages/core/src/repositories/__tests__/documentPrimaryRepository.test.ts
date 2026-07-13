import type { EntityId } from '../../local-first/documentModel'
import { SAMPLE_TRIP_DOCUMENT_V1 } from '../../local-first/tripDocument'
import {
  createEmptyTemplateDocumentV1,
  type TemplateDocumentV1,
} from '../../local-first/templateDocument'
import {
  createDocumentPrimaryRepositoryBundle,
  type LocalDocumentStore,
} from '../documentPrimaryRepository'
import type { TripDocumentV1 } from '../../local-first/documentModel'
import type { DocumentMutationResult } from '../../local-first/documentMutationWriter'

class MemoryDocumentStore<TDocument> implements LocalDocumentStore<TDocument> {
  private documents = new Map<EntityId, TDocument>()
  public writes: Array<{ documentId: EntityId; update?: Uint8Array }> = []

  constructor(initialDocuments: Array<{ id: EntityId; document: TDocument }> = []) {
    for (const { id, document } of initialDocuments) {
      this.documents.set(id, clone(document))
    }
  }

  async listDocumentIds(): Promise<EntityId[]> {
    return Array.from(this.documents.keys())
  }

  async getDocument(documentId: EntityId): Promise<TDocument | null> {
    const document = this.documents.get(documentId)
    return document ? clone(document) : null
  }

  async putDocument(documentId: EntityId, document: TDocument, update?: Uint8Array): Promise<void> {
    this.documents.set(documentId, clone(document))
    this.writes.push({ documentId, update })
  }
}

const actor = {
  userId: 'user-1',
  role: 'owner' as const,
  status: 'accepted' as const,
}

const tripDocument: TripDocumentV1 = {
  ...clone(SAMPLE_TRIP_DOCUMENT_V1),
  trip: {
    ...SAMPLE_TRIP_DOCUMENT_V1.trip,
    id: 'trip-1',
    ownerId: 'user-1',
  },
  checklists: {
    'checklist-1': {
      id: 'checklist-1',
      title: 'Packing',
      createdAt: '2026-07-14T00:00:00.000Z',
    },
  },
  members: {
    'member-1': {
      id: 'member-1',
      userId: 'user-1',
      invitedEmail: null,
      role: 'owner',
      status: 'accepted',
      nickname: 'Owner',
      email: 'owner@example.com',
      createdAt: '2026-07-14T00:00:00.000Z',
      updatedAt: null,
    },
  },
}

const templateDocument: TemplateDocumentV1 = createEmptyTemplateDocumentV1({
  id: 'template-1',
  ownerId: 'user-1',
  title: 'Basics',
  createdAt: '2026-07-14T00:00:00.000Z',
})
templateDocument.items['template-item-1'] = {
  id: 'template-item-1',
  templateId: 'template-1',
  name: 'Passport',
  categoryName: 'Documents',
  isPrivate: false,
  sortOrder: 0,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
}

const tripStore = new MemoryDocumentStore<TripDocumentV1>([
  { id: 'trip-1', document: tripDocument },
])
const templateStore = new MemoryDocumentStore<TemplateDocumentV1>([
  { id: 'template-1', document: templateDocument },
])
const published: Array<DocumentMutationResult<TripDocumentV1 | TemplateDocumentV1>> = []

const repositories = createDocumentPrimaryRepositoryBundle({
  tripStore,
  templateStore,
  runtime: {
    actor,
    publisher: {
      publishMutation: (result) => {
        published.push(result)
      },
    },
  },
})

async function runDocumentPrimaryRepositoryTest(): Promise<void> {
  const planResult = await repositories.plans.createPlan('trip-1', {
    id: 'plan-1',
    title: 'Airport',
    location: 'ICN',
    address: null,
    coordinates: null,
    googlePlaceId: null,
    imageUrl: null,
    photoReference: null,
    startDateTimeLocal: '2026-07-14T10:00:00',
    endDateTimeLocal: '2026-07-14T11:00:00',
    timezone: 'Asia/Seoul',
    alarmMinutesBefore: null,
    alarmSentAt: null,
    cost: 0,
    memo: null,
    isCompleted: false,
    isVisited: false,
    createdAt: '2026-07-14T00:00:00.000Z',
  })

  if (planResult.document.plans['plan-1']?.title !== 'Airport') {
    throw new Error('Document-primary plan repository should create plan nodes.')
  }
  if (planResult.update.length === 0) {
    throw new Error('Document-primary mutation should include encoded update bytes.')
  }

  await repositories.checklists.applyTemplate('trip-1', 'checklist-1', 'template-1', ['item-1'])
  const checklist = await repositories.checklists.getChecklist('trip-1')
  const appliedItem = checklist[0]?.items.find((item) => item.id === 'item-1')
  if (appliedItem?.name !== 'Passport' || appliedItem.sourceTemplateName !== 'Basics') {
    throw new Error('Template apply should copy template item data into trip checklist items.')
  }

  await repositories.members.revokeMember('trip-1', 'member-1')
  const members = await repositories.members.listMembers('trip-1')
  if (members.some((member) => member.id === 'member-1')) {
    throw new Error('Revoked members should be hidden from member read models.')
  }

  await repositories.templates.replaceItems('template-1', {
    now: '2026-07-14T01:00:00.000Z',
    items: [
      {
        id: 'template-item-2',
        name: 'Sunscreen',
        categoryName: 'Health',
        isPrivate: false,
        sortOrder: 0,
      },
    ],
  })
  const template = await repositories.templates.getTemplate('template-1')
  if (template?.items[0]?.name !== 'Sunscreen') {
    throw new Error('Template repository should replace template items.')
  }

  if (tripStore.writes.length < 3 || templateStore.writes.length !== 1) {
    throw new Error('Document-primary repositories should persist document mutations through stores.')
  }
  if (published.length < 4) {
    throw new Error('Document-primary repositories should publish mutation results.')
  }
}

void runDocumentPrimaryRepositoryTest()

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
