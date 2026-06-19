export interface Trip {
  id: string
  user_id: string
  destination: string
  start_date: string        // date (YYYY-MM-DD)
  end_date: string          // date (YYYY-MM-DD)
  adults_count: number
  children_count: number
  created_at: string
  updated_at: string
}

export interface TripMember {
  id: string
  trip_id: string
  user_id: string | null    // null = 초대 대기 중
  invited_email: string
  role: 'owner' | 'editor' | 'viewer'
  status: 'pending' | 'accepted'
  created_at: string
  profiles?: {
    nickname: string | null
    email: string | null
  }
}

export interface TripShare {
  id: string
  trip_id: string
  share_token: string
  share_type: 'public' | 'password'
  password_hash: string | null
  expires_at: string | null
  created_at: string
}

export type TripRole = 'owner' | 'editor' | 'viewer' | null
