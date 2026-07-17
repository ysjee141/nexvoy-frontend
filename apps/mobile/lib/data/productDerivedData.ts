import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getTravelStats,
  getVisitedPlacesByUser,
  type TripDetailReadModel,
  type TripSummaryReadModel,
} from '@nexvoy/core'
import type { TravelStats, VisitedPlace } from '@nexvoy/types'
import {
  createMobileProductRepositories,
  isMobileServerAuthorityEnabled,
} from './repositoryFactory'

export interface MobileProductDeletionSummary {
  tripCount: number
  itemCount: number
}

export async function getMobileProductTravelStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<TravelStats> {
  if (!isMobileServerAuthorityEnabled()) return getTravelStats(supabase, userId)

  const repositories = await createMobileProductRepositories(supabase)
  const trips = (await repositories.trips.listTrips(userId))
    .filter((trip) => trip.ownerId === userId)
  return deriveTravelStats(trips)
}

export async function getMobileProductVisitedPlaces(
  supabase: SupabaseClient,
  userId: string,
): Promise<VisitedPlace[]> {
  if (!isMobileServerAuthorityEnabled()) return getVisitedPlacesByUser(supabase, userId)

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
  if (!isMobileServerAuthorityEnabled()) {
    const repositories = await createMobileProductRepositories(supabase)
    const trips = (await repositories.trips.listTrips(userId))
      .filter((trip) => trip.ownerId === userId)
    const details = await Promise.all(trips.map((trip) => repositories.trips.getTrip(trip.id)))
    return summarizeDeletion(trips, details)
  }

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

function deriveTravelStats(trips: TripSummaryReadModel[]): TravelStats {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let totalDays = 0
  let completedCount = 0
  let longestTripDays = 0
  const destinations = new Set<string>()
  const pastTrips: TravelStats['pastTrips'] = []
  const upcomingTrips: TravelStats['upcomingTrips'] = []

  for (const trip of trips) {
    const days = inclusiveDays(trip.startDate, trip.endDate)
    totalDays += days
    longestTripDays = Math.max(longestTripDays, days)
    if (trip.destination) destinations.add(trip.destination)
    const entry = {
      id: trip.id,
      destination: trip.destination,
      start_date: trip.startDate,
      end_date: trip.endDate,
    }
    if (parseLocalDate(trip.endDate).getTime() < today.getTime()) {
      completedCount += 1
      pastTrips.push(entry)
    } else {
      upcomingTrips.push(entry)
    }
  }

  pastTrips.sort((a, b) => parseLocalDate(b.start_date).getTime() - parseLocalDate(a.start_date).getTime())
  upcomingTrips.sort((a, b) => parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime())
  return {
    totalDays,
    completedCount,
    longestTripDays,
    uniqueDestinations: destinations.size,
    pastTrips,
    upcomingTrips,
  }
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

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part))
  return new Date(year, (month || 1) - 1, day || 1)
}

function inclusiveDays(start: string, end: string): number {
  const difference = Math.round(
    (parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / 86_400_000,
  )
  return difference >= 0 ? difference + 1 : 1
}
