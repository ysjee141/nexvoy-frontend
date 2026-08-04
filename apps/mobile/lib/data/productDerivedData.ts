import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  TripDetailReadModel,
  TripSummaryReadModel,
} from '@nexvoy/core/product/readModels'
import type { TravelStats, VisitedPlace } from '@nexvoy/types'
import {
  createMobileProductRepositories,
  refreshMobileProductList,
} from './repositoryFactory'
import { loadTravelStatsFromSource } from './travelStats'

export interface MobileProductDeletionSummary {
  tripCount: number
  itemCount: number
}

export async function getMobileProductTravelStats(
  supabase: SupabaseClient,
  userId: string,
  options: { refresh?: boolean } = {},
): Promise<TravelStats> {
  const repositories = await createMobileProductRepositories(supabase)
  return loadTravelStatsFromSource({
    listTrips: () => repositories.trips.listTrips(userId),
    refreshTrips: options.refresh
      ? () => refreshMobileProductList(supabase, 'trip')
      : undefined,
  })
}

export async function getMobileProductVisitedPlaces(
  supabase: SupabaseClient,
  userId: string,
): Promise<VisitedPlace[]> {
  const trips = await listOwnedTripDetails(supabase, userId)
  const byLocation = new Map<string, VisitedPlace>()
  for (const trip of trips) {
    for (const plan of trip.plans) {
      const location = plan.location?.trim()
      if (!location) continue
      const entry = byLocation.get(location) ?? {
        location,
        trip_count: 0,
        trips: [],
      }
      if (!entry.trips.some((item) => item.id === trip.id)) {
        entry.trips.push({
          id: trip.id,
          destination: trip.destination,
          start_date: trip.startDate,
        })
        entry.trip_count = entry.trips.length
      }
      byLocation.set(location, entry)
    }
  }
  return [...byLocation.values()].sort((a, b) => b.trip_count - a.trip_count)
}

export async function getMobileProductDeletionSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileProductDeletionSummary> {
  const repositories = await createMobileProductRepositories(supabase)
  const trips = (await repositories.trips.listTrips(userId))
    .filter((trip) => trip.ownerId === userId)
  const details = await Promise.all(trips.map((trip) => repositories.trips.getTrip(trip.id)))
  return summarizeDeletion(trips, details)
}

async function listOwnedTripDetails(
  supabase: SupabaseClient,
  userId: string,
): Promise<TripDetailReadModel[]> {
  const repositories = await createMobileProductRepositories(supabase)
  const summaries = (await repositories.trips.listTrips(userId))
    .filter((trip) => trip.ownerId === userId)
  const details = await Promise.all(
    summaries.map((trip) => repositories.trips.getTrip(trip.id)),
  )
  return details.filter((trip): trip is TripDetailReadModel => trip !== null)
}

function summarizeDeletion(
  trips: TripSummaryReadModel[],
  details: Array<TripDetailReadModel | null>,
): MobileProductDeletionSummary {
  return {
    tripCount: trips.length,
    itemCount: details.reduce(
      (total, trip) => total + (trip?.checklists.reduce(
        (tripTotal, checklist) => tripTotal + checklist.items.length,
        0,
      ) ?? 0),
      0,
    ),
  }
}
