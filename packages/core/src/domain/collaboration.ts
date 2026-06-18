import type { SupabaseClient } from '@supabase/supabase-js'
import type { TripMember, TripShare, TripRole } from '@nexvoy/types'

// collaboration.ts의 순수하게 추출 가능한 로직만 이관.
// createClient() 직접 호출 대신 sb 주입 방식으로 리팩토링.

export async function inviteMember(
  sb: SupabaseClient,
  tripId: string,
  email: string,
  role: 'editor' | 'viewer' = 'editor'
): Promise<{ data: TripMember | null; error: Error | null }> {
  const { data, error } = await sb
    .from('trip_members')
    .insert({ trip_id: tripId, invited_email: email, role, status: 'pending' })
    .select()
    .single()
  return { data, error }
}

export async function acceptInvite(
  sb: SupabaseClient,
  memberId: string,
  userId: string
): Promise<{ data: TripMember | null; error: Error | null }> {
  const { data, error } = await sb
    .from('trip_members')
    .update({ user_id: userId, status: 'accepted' })
    .eq('id', memberId)
    .select()
    .single()
  return { data, error }
}

export async function getMembers(
  sb: SupabaseClient,
  tripId: string
): Promise<TripMember[]> {
  const { data, error } = await sb
    .from('trip_members')
    .select('*, profiles(nickname, email)')
    .eq('trip_id', tripId)
  if (error) throw error
  return data ?? []
}

export async function getOrCreateShareLink(
  sb: SupabaseClient,
  tripId: string,
  type: 'public' | 'password' = 'public',
  password?: string
): Promise<{ data: TripShare | null; error: Error | null }> {
  const { data: existing } = await sb
    .from('trip_shares')
    .select('*')
    .eq('trip_id', tripId)
    .eq('share_type', type)
    .maybeSingle()
  if (existing) return { data: existing, error: null }

  const shareToken = crypto.randomUUID()
  const insertData: Record<string, unknown> = { trip_id: tripId, share_token: shareToken, share_type: type }
  if (type === 'password' && password) insertData.password_hash = password

  const { data, error } = await sb
    .from('trip_shares')
    .insert(insertData)
    .select()
    .single()
  return { data, error }
}

export async function getUserRole(
  sb: SupabaseClient,
  tripId: string,
  userId: string
): Promise<TripRole> {
  const { data: trip } = await sb
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single()
  if (trip?.user_id === userId) return 'owner'

  const { data: member } = await sb
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle()
  return (member?.role as TripRole) ?? null
}
