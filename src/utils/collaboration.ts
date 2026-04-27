import { createClient } from '@/utils/supabase/client'

/**
 * 동행 및 공유 관련 유틸리티
 * 모든 메서드 내부에서 createClient()를 호출하여 최신 클라이언트 인스턴스(특히 앱 리셋 후)를 사용하도록 합니다.
 */
export const collaboration = {
    /**
     * 특정 이메일로 동행자 초대
     */
    async inviteMember(tripId: string, email: string, role: 'editor' | 'viewer' = 'editor') {
        const supabase = createClient()
        // upsert가 404를 일으키는 경우를 대비해, insert로 시도하고 에러를 확인합니다.
        // 또한 404가 나면 테이블 존재 여부나 RLS 정책을 의심해봐야 합니다.
        const { data, error } = await supabase
            .from('trip_members')
            .insert({
                trip_id: tripId,
                invited_email: email,
                role,
                status: 'pending'
            })
            .select()
            .single()

        return { data, error }
    },

    /**
     * 현재 로그인한 사용자가 초대된 여행 목록 조회 (수락 대기 중 포함)
     */
    async getInvitedTrips() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: 'User not authenticated' }

        const { data, error } = await supabase
            .from('trip_members')
            .select('*, trips(*)')
            .eq('invited_email', user.email)
            .eq('status', 'pending')

        return { data, error }
    },

    /**
     * 초대 수락
     */
    async acceptInvite(memberId: string) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: 'User not authenticated' }

        const { data, error } = await supabase
            .from('trip_members')
            .update({
                user_id: user.id,
                status: 'accepted'
            })
            .eq('id', memberId)
            .select()
            .single()

        return { data, error }
    },

    /**
     * 여행의 멤버 목록 조회
     */
    async getMembers(tripId: string) {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('trip_members')
            .select('*, profiles(nickname, email)')
            .eq('trip_id', tripId)

        return { data, error }
    },

    /**
     * 공유 링크 생성 또는 기존 링크 조회
     */
    async getOrCreateShareLink(tripId: string, type: 'public' | 'password' = 'public', password?: string) {
        const supabase = createClient()
        // 이미 존재하는 링크 확인
        const { data: existing } = await supabase
            .from('trip_shares')
            .select('*')
            .eq('trip_id', tripId)
            .eq('share_type', type)
            .maybeSingle()

        if (existing) return { data: existing, error: null }

        // 새 토큰 생성 (uuid 기반)
        const shareToken = crypto.randomUUID()

        const insertData: any = {
            trip_id: tripId,
            share_token: shareToken,
            share_type: type
        }

        if (type === 'password' && password) {
            insertData.password_hash = password
        }

        const { data, error } = await supabase
            .from('trip_shares')
            .insert(insertData)
            .select()
            .single()

        return { data, error }
    },

    /**
     * 동행자 역할 업데이트
     */
    async updateMemberRole(memberId: string, role: 'editor' | 'viewer') {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('trip_members')
            .update({ role })
            .eq('id', memberId)
            .select()
            .single()

        return { data, error }
    },

    /**
     * 동행자 삭제
     */
    async removeMember(memberId: string) {
        const supabase = createClient()
        const { error } = await supabase
            .from('trip_members')
            .delete()
            .eq('id', memberId)

        return { error }
    },

    /**
     * 현재 사용자 정보 조회
     */
    async getCurrentUser() {
        const supabase = createClient()
        return await supabase.auth.getUser()
    },

    /**
     * 특정 사용자의 프로필 정보 조회
     */
    async getProfile(userId: string) {
        const supabase = createClient()
        return await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
    },

    /**
     * 특정 여행에서 현재 사용자의 역할 조회
     */
    async getUserRole(tripId: string) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: 'Not authenticated' }

        // 1. 여행 소유자인지 확인
        const { data: trip } = await supabase
            .from('trips')
            .select('user_id')
            .eq('id', tripId)
            .single()

        if (trip?.user_id === user.id) return { data: 'owner', error: null }

        // 2. 멤버 목록에서 확인
        const { data: member } = await supabase
            .from('trip_members')
            .select('role')
            .eq('trip_id', tripId)
            .eq('user_id', user.id)
            .eq('status', 'accepted')
            .maybeSingle()

        if (member) return { data: member.role, error: null }

        return { data: null, error: 'No member found' }
    },

    /**
     * 초대 링크 생성
     */
    async createInvitationLink(tripId: string) {
        const supabase = createClient()
        const { data, error } = await supabase.rpc('generate_invitation_link', { p_trip_id: tripId })
        return { data, error }
    },

    /**
     * 초대 링크의 여정 요약 정보 조회
     */
    async getTripSummaryByToken(token: string) {
        const supabase = createClient()
        const { data, error } = await supabase.rpc('get_trip_summary_by_token', { p_token: token })
        return { data, error }
    },

    /**
     * 초대 링크를 통한 참여
     */
    async joinTripViaToken(token: string) {
        const supabase = createClient()
        const { data, error } = await supabase.rpc('join_trip_via_token', { p_token: token })
        return { data, error }
    }
}
