import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type AuthorityCommand,
  type AuthorityProductSyncSnapshot,
  type AuthorityResourceType,
  type CanonicalResourceBundle,
} from '../../authority/serverAuthorityTypes'
import { applyOptimisticAuthorityCommandsToBundle } from '../../authority/serverAuthorityMaterialize'
import { versionAuthorityCommandsForBundle } from '../../authority/serverAuthorityMaterialize'
import {
  createServerAuthorityProductRepositories,
  createServerAuthorityTemplate,
  createServerAuthorityTrip,
  type ServerAuthorityActorRole,
  type ServerAuthorityProductRuntime,
} from '../serverAuthorityProductRepository'

class MemoryAuthorityRuntime implements ServerAuthorityProductRuntime {
  readonly bundles = new Map<string, CanonicalResourceBundle>()
  readonly commits: AuthorityCommand[][] = []

  accountId(): Promise<string> {
    return Promise.resolve('account-1')
  }

  isOnline(): Promise<boolean> {
    return Promise.resolve(false)
  }

  listLocal(resourceType: AuthorityResourceType): Promise<CanonicalResourceBundle[]> {
    return Promise.resolve(
      [...this.bundles.values()].filter((bundle) => bundle.resourceType === resourceType),
    )
  }

  getBundle(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null> {
    return Promise.resolve(this.bundles.get(`${resourceType}:${resourceId}`) ?? null)
  }

  commit(
    bundle: CanonicalResourceBundle,
    commands: AuthorityCommand[],
  ): Promise<CanonicalResourceBundle> {
    const versionedCommands = versionAuthorityCommandsForBundle(bundle, commands)
    const optimistic = applyOptimisticAuthorityCommandsToBundle(
      bundle,
      versionedCommands,
      '2026-07-17T00:00:00.000Z',
    )
    this.bundles.set(`${bundle.resourceType}:${bundle.resourceId}`, optimistic)
    this.commits.push(versionedCommands)
    return Promise.resolve(optimistic)
  }

  cacheRole(
    _accountId: string,
    bundle: CanonicalResourceBundle,
    role: ServerAuthorityActorRole,
  ): Promise<CanonicalResourceBundle> {
    const cached = { ...bundle, data: { ...bundle.data, _role: role } }
    this.bundles.set(`${bundle.resourceType}:${bundle.resourceId}`, cached)
    return Promise.resolve(cached)
  }

  syncSnapshot(): Promise<AuthorityProductSyncSnapshot> {
    return Promise.resolve({ status: 'synced', pendingCount: 0, lastError: null })
  }

  resolveConflict(): Promise<void> {
    return Promise.resolve()
  }
}

async function runServerAuthorityProductRepositoryTest(): Promise<void> {
  const runtime = new MemoryAuthorityRuntime()
  const supabase = {} as SupabaseClient
  const tripId = await createServerAuthorityTrip({
    runtime,
    destination: 'Jeonju',
    startDate: '2026-07-20',
    endDate: '2026-07-24',
    adultsCount: 2,
    childrenCount: 1,
  })

  const repositories = await createServerAuthorityProductRepositories(
    supabase,
    runtime,
    { actorRole: 'owner' },
  )
  const trips = await repositories.trips.listTrips('account-1')
  if (trips.length !== 1 || trips[0]?.destination !== 'Jeonju') {
    throw new Error('Authority trip creation should be immediately readable from local state.')
  }
  const initial = await repositories.trips.getTrip(tripId)
  if (initial?.checklists.length !== 1 || initial.checklists[0]?.title !== '준비물') {
    throw new Error('Authority trip creation should include the default checklist atomically.')
  }
  if (runtime.commits[0]?.map((command) => command.entityType).join(',') !== 'trip,checklist') {
    throw new Error('Authority trip bootstrap should enqueue trip and checklist commands together.')
  }

  await repositories.checklists.createItem(tripId, {
    id: 'checklist-item-offline-1',
    checklistId: initial.checklists[0].id,
    name: 'Offline passport',
    categoryName: 'Documents',
    legacyIsChecked: false,
    isPrivate: false,
    assignmentType: 'anyone',
    assignedUserId: null,
    sourceTemplateName: null,
    assigneeIds: [],
  })
  const offlineChecklist = await repositories.checklists.getChecklist(tripId)
  if (offlineChecklist[0]?.items[0]?.name !== 'Offline passport') {
    throw new Error('Offline checklist mutations should be immediately readable from local state.')
  }

  await repositories.plans.createPlan(tripId, {
    id: 'plan-1',
    title: 'Hanok Village',
    location: 'Jeonju Hanok Village',
    address: null,
    coordinates: null,
    googlePlaceId: null,
    imageUrl: null,
    photoReference: null,
    startDateTimeLocal: '2026-07-20T10:00:00',
    endDateTimeLocal: '2026-07-20T11:00:00',
    timezone: 'Asia/Seoul',
    alarmMinutesBefore: null,
    alarmSentAt: null,
    cost: 0,
    memo: null,
    isCompleted: false,
    isVisited: false,
    createdAt: '2026-07-17T00:00:00.000Z',
  })
  const plans = await repositories.plans.listPlans(tripId)
  if (plans[0]?.title !== 'Hanok Village') {
    throw new Error('Authority mutations should update the local read model optimistically.')
  }

  const templateId = await createServerAuthorityTemplate({
    runtime,
    title: 'Summer basics',
    items: [{ item_name: 'Passport', category: 'Documents' }],
  })
  const template = await repositories.templates.getTemplate(templateId)
  if (template?.items[0]?.name !== 'Passport') {
    throw new Error('Authority template creation should be immediately readable from local state.')
  }

  const viewerRepositories = await createServerAuthorityProductRepositories(
    supabase,
    runtime,
    { actorRole: 'viewer' },
  )
  await expectReject(
    viewerRepositories.trips.updateTrip(tripId, { destination: 'Blocked' }),
    'Viewer mutations must be rejected before entering the outbox.',
  )
}

async function expectReject(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise
  } catch {
    return
  }
  throw new Error(message)
}

void runServerAuthorityProductRepositoryTest()
