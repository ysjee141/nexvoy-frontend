// Re-export from trip.ts for convenience
export type { TripMember, TripShare, TripRole } from './trip'

export interface InvitationLink {
  token: string
  trip_id: string
  expires_at: string | null
}

export interface TripSummary {
  id: string
  destination: string
  start_date: string
  end_date: string
  owner_nickname: string | null
}
