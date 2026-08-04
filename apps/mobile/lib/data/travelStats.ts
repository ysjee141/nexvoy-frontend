import type { TripSummaryReadModel } from '@nexvoy/core/product/readModels'
import type { TravelStats } from '@nexvoy/types'

export interface TravelStatsSource {
  listTrips: () => Promise<TripSummaryReadModel[]>
  refreshTrips?: () => Promise<unknown>
}

export async function loadTravelStatsFromSource(
  userId: string,
  source: TravelStatsSource,
): Promise<TravelStats> {
  let refreshError: unknown = null
  if (source.refreshTrips) {
    try {
      await source.refreshTrips()
    } catch (error) {
      refreshError = error
    }
  }

  const localTrips = await source.listTrips()
  if (refreshError && localTrips.length === 0) throw refreshError

  const trips = localTrips.filter((trip) => trip.ownerId === userId)
  return deriveTravelStats(trips)
}

export function deriveTravelStats(
  trips: TripSummaryReadModel[],
  now: Date = new Date(),
): TravelStats {
  const today = new Date(now)
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

  pastTrips.sort(
    (a, b) => parseLocalDate(b.start_date).getTime() - parseLocalDate(a.start_date).getTime(),
  )
  upcomingTrips.sort(
    (a, b) => parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime(),
  )
  return {
    totalDays,
    completedCount,
    longestTripDays,
    uniqueDestinations: destinations.size,
    pastTrips,
    upcomingTrips,
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
