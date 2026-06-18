export interface Plan {
  id: string
  trip_id: string
  title: string
  location: string | null
  address: string | null
  lat: number | null
  lng: number | null
  location_lat?: number | null
  location_lng?: number | null
  visit_date?: string | null
  visit_time?: string | null
  start_datetime_local: string  // timestamp without timezone (local)
  end_datetime_local: string
  timezone_string: string
  alarm_minutes_before: number | null
  alarm_sent_at: string | null
  cost: number
  memo: string | null
  image_url: string | null
  photo_reference: string | null
  google_place_id: string | null
  is_completed: boolean
  is_visited: boolean
  created_at: string
  updated_at: string
}

export interface PlanUrl {
  id: string
  plan_id: string
  url: string
  created_at: string
}
