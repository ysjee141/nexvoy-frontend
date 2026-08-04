import assert from 'node:assert/strict'
import test from 'node:test'
import type { TripSummaryReadModel } from '@nexvoy/core/product/readModels'
import {
  deriveTravelStats,
  loadTravelStatsFromSource,
} from '../travelStats'

const USER_ID = 'user-1'
const TODAY = new Date(2026, 7, 4, 12)

test('derives completed, upcoming, duration, and destination statistics', () => {
  const stats = deriveTravelStats([
    trip({ id: 'past', destination: '부산', startDate: '2026-07-01', endDate: '2026-07-03' }),
    trip({ id: 'today', destination: '서울', startDate: '2026-08-04', endDate: '2026-08-04' }),
    trip({ id: 'future', destination: '부산', startDate: '2026-09-01', endDate: '2026-09-02' }),
  ], TODAY)

  assert.equal(stats.completedCount, 1)
  assert.equal(stats.totalDays, 6)
  assert.equal(stats.longestTripDays, 3)
  assert.equal(stats.uniqueDestinations, 2)
  assert.deepEqual(stats.pastTrips.map((item) => item.id), ['past'])
  assert.deepEqual(stats.upcomingTrips.map((item) => item.id), ['today', 'future'])
})

test('refreshes before reading and includes accessible collaborator trips', async () => {
  const calls: string[] = []
  const stats = await loadTravelStatsFromSource({
    refreshTrips: async () => { calls.push('refresh') },
    listTrips: async () => {
      calls.push('list')
      return [
        trip({ id: 'owned', endDate: '2026-07-03' }),
        trip({ id: 'shared', ownerId: 'user-2', endDate: '2026-07-03' }),
      ]
    },
  })

  assert.deepEqual(calls, ['refresh', 'list'])
  assert.equal(stats.completedCount, 2)
  assert.deepEqual(stats.pastTrips.map((item) => item.id), ['owned', 'shared'])
})

test('falls back to the local trip list when refresh fails', async () => {
  const stats = await loadTravelStatsFromSource({
    refreshTrips: async () => { throw new Error('offline') },
    listTrips: async () => [trip({ id: 'local', startDate: '2026-08-10', endDate: '2026-08-10' })],
  })

  assert.equal(stats.completedCount, 0)
  assert.deepEqual(stats.upcomingTrips.map((item) => item.id), ['local'])
  assert.equal(stats.totalDays, 1)
})

test('surfaces a refresh failure when no local trips can be shown', async () => {
  await assert.rejects(
    loadTravelStatsFromSource({
      refreshTrips: async () => { throw new Error('authority unavailable') },
      listTrips: async () => [],
    }),
    /authority unavailable/,
  )
})

function trip(
  overrides: Partial<TripSummaryReadModel> & Pick<TripSummaryReadModel, 'id'>,
): TripSummaryReadModel {
  const { id, ...rest } = overrides
  return {
    id,
    ownerId: USER_ID,
    destination: '제주',
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    adultsCount: 1,
    childrenCount: 0,
    coverImageRef: null,
    bgColor: null,
    memberCount: 1,
    planCount: 0,
    checklistTotalCount: 0,
    checklistDoneCount: 0,
    progressPercent: 0,
    updatedAt: '2026-08-04T00:00:00.000Z',
    ...rest,
  }
}
