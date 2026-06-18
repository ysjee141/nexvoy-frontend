import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trip, Plan, Checklist, ChecklistItem, ChecklistTemplate, ChecklistTemplateItem, Profile } from '@nexvoy/types'

// ─── Trips ───────────────────────────────────────────────────────────────────

export async function getTripsByUser(
  sb: SupabaseClient,
  userId: string
): Promise<Trip[]> {
  const [ownedRes, memberRes] = await Promise.all([
    sb.from('trips').select('*').eq('user_id', userId).order('start_date'),
    sb
      .from('trip_members')
      .select('trips(*)')
      .eq('user_id', userId)
      .eq('status', 'accepted'),
  ])

  if (ownedRes.error) throw ownedRes.error
  if (memberRes.error) throw memberRes.error

  const memberTrips = (memberRes.data ?? [])
    .map((m: { trips: Trip | Trip[] | null }) => m.trips)
    .filter((t): t is Trip => t !== null && !Array.isArray(t))

  const owned = ownedRes.data ?? []
  const ownedIds = new Set(owned.map((t) => t.id))
  const unique = [...owned, ...memberTrips.filter((t) => !ownedIds.has(t.id))]

  return unique.sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  )
}

export async function getTripById(
  sb: SupabaseClient,
  tripId: string
): Promise<Trip | null> {
  const { data, error } = await sb
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()
  if (error) throw error
  return data
}

export async function getTripWithPlans(
  sb: SupabaseClient,
  tripId: string
): Promise<{ trip: Trip; plans: Plan[] }> {
  const [tripRes, plansRes] = await Promise.all([
    sb.from('trips').select('*').eq('id', tripId).single(),
    sb
      .from('plans')
      .select('*')
      .eq('trip_id', tripId)
      .order('start_datetime_local'),
  ])
  if (tripRes.error) throw tripRes.error
  if (plansRes.error) throw plansRes.error
  return { trip: tripRes.data, plans: plansRes.data ?? [] }
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function getPlansByTrip(
  sb: SupabaseClient,
  tripId: string
): Promise<Plan[]> {
  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('trip_id', tripId)
    .order('start_datetime_local')
  if (error) throw error
  return data ?? []
}

// ─── Checklists ───────────────────────────────────────────────────────────────

export async function getChecklistByTrip(
  sb: SupabaseClient,
  tripId: string
): Promise<{ checklist: Checklist; items: ChecklistItem[] } | null> {
  const { data: checklist, error: clErr } = await sb
    .from('checklists')
    .select('*')
    .eq('trip_id', tripId)
    .single()
  if (clErr) {
    if (clErr.code === 'PGRST116') return null // not found
    throw clErr
  }
  const { data: items, error: itemErr } = await sb
    .from('checklist_items')
    .select('*')
    .eq('checklist_id', checklist.id)
    .order('category')
  if (itemErr) throw itemErr
  return { checklist, items: items ?? [] }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(
  sb: SupabaseClient,
  userId: string
): Promise<ChecklistTemplate[]> {
  const { data, error } = await sb
    .from('checklist_templates')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getTemplateWithItems(
  sb: SupabaseClient,
  templateId: string
): Promise<{ template: ChecklistTemplate; items: ChecklistTemplateItem[] } | null> {
  const { data: template, error: tErr } = await sb
    .from('checklist_templates')
    .select('*')
    .eq('id', templateId)
    .single()
  if (tErr) {
    if (tErr.code === 'PGRST116') return null
    throw tErr
  }
  const { data: items, error: iErr } = await sb
    .from('checklist_template_items')
    .select('*')
    .eq('template_id', templateId)
    .order('category')
  if (iErr) throw iErr
  return { template, items: items ?? [] }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(
  sb: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}
