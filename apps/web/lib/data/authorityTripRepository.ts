import type { SupabaseClient } from '@supabase/supabase-js'
import type { TripRepository } from '@nexvoy/core/repositories/types'
import type { Trip } from '@nexvoy/types'
import {
  createWebAuthorityDocumentRepositories,
  createWebAuthorityTrip,
} from './authorityProductRepositories'

export function createWebAuthorityTripRepository(supabase: SupabaseClient): TripRepository {
  return {
    async listTrips(userId) {
      const repositories = await createWebAuthorityDocumentRepositories(supabase)
      const summaries = await repositories.trips.listTrips(userId)
      return summaries.map((summary) => toTripRow(summary, summary.updatedAt))
    },
    async getTrip(tripId) {
      const repositories = await createWebAuthorityDocumentRepositories(supabase)
      const detail = await repositories.trips.getTrip(tripId)
      return detail ? toTripRow(detail, detail.updatedAt) : null
    },
    async getTripDocument(tripId) {
      return (await createWebAuthorityDocumentRepositories(supabase)).trips.getTripDocument(tripId)
    },
    async getTripWithPlans(tripId) {
      const repositories = await createWebAuthorityDocumentRepositories(supabase)
      const [trip, plans] = await Promise.all([
        repositories.trips.getTrip(tripId),
        repositories.plans.listPlans(tripId),
      ])
      if (!trip) throw new Error('Trip was not found.')
      return {
        trip: toTripRow(trip, trip.updatedAt),
        plans: plans.map((plan) => ({
          id: plan.id,
          trip_id: tripId,
          title: plan.title,
          location: plan.location,
          address: plan.address,
          lat: plan.coordinates?.lat ?? null,
          lng: plan.coordinates?.lng ?? null,
          location_lat: plan.coordinates?.lat ?? null,
          location_lng: plan.coordinates?.lng ?? null,
          start_datetime_local: plan.startDateTimeLocal,
          end_datetime_local: plan.endDateTimeLocal,
          timezone_string: plan.timezone,
          alarm_minutes_before: plan.alarmMinutesBefore,
          alarm_sent_at: plan.alarmSentAt,
          cost: plan.cost,
          memo: plan.memo,
          image_url: plan.imageUrl,
          photo_reference: plan.photoReference,
          google_place_id: plan.googlePlaceId,
          is_completed: plan.isCompleted,
          is_visited: plan.isVisited,
          visit_date: null,
          visit_time: null,
          created_at: trip.updatedAt,
          updated_at: trip.updatedAt,
        })),
      }
    },
    async createTrip(input) {
      const id = await createWebAuthorityTrip({
        supabase,
        destination: input.destination,
        startDate: input.start_date,
        endDate: input.end_date,
        adultsCount: input.adults_count,
        childrenCount: input.children_count,
      })
      const trip = await this.getTrip(id)
      if (!trip) throw new Error('Created trip was not found in the local authority cache.')
      return trip
    },
    async updateTrip(tripId, input) {
      const repositories = await createWebAuthorityDocumentRepositories(supabase, { actorRole: 'owner' })
      const result = await repositories.trips.updateTrip(tripId, {
        destination: input.destination,
        startDate: input.start_date,
        endDate: input.end_date,
        adultsCount: input.adults_count,
        childrenCount: input.children_count,
      })
      return toTripRow({
        id: result.document.trip.id,
        ownerId: result.document.trip.ownerId,
        destination: result.document.trip.destination,
        startDate: result.document.trip.startDate,
        endDate: result.document.trip.endDate,
        adultsCount: result.document.trip.adultsCount,
        childrenCount: result.document.trip.childrenCount,
      }, result.document.trip.updatedAt)
    },
    async deleteTrip(tripId) {
      const repositories = await createWebAuthorityDocumentRepositories(supabase, { actorRole: 'owner' })
      await repositories.trips.deleteTrip(tripId)
    },
  }
}

function toTripRow(
  input: {
    id: string
    ownerId: string
    destination: string
    startDate: string
    endDate: string
    adultsCount: number
    childrenCount: number
  },
  updatedAt: string,
): Trip {
  return {
    id: input.id,
    user_id: input.ownerId,
    destination: input.destination,
    start_date: input.startDate,
    end_date: input.endDate,
    adults_count: input.adultsCount,
    children_count: input.childrenCount,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
}
