// 웹 전용 캐시 유틸 — localStorage 기반 (Capacitor Preferences 대체)
// 모든 메서드는 SSR 안전성을 위해 window 존재 여부를 확인한다.

const hasWindow = () => typeof window !== 'undefined'

export const CacheUtil = {
    async set(key: string, value: any) {
        if (!hasWindow()) return
        try {
            localStorage.setItem(key, JSON.stringify(value))
        } catch (e) {
            console.warn('Cache writing failed', e)
        }
    },

    async get<T>(key: string): Promise<T | null> {
        if (!hasWindow()) return null
        try {
            const value = localStorage.getItem(key)
            if (value) {
                return JSON.parse(value) as T
            }
        } catch (e) {
            console.warn('Cache reading failed', e)
        }
        return null
    },

    async remove(key: string) {
        if (!hasWindow()) return
        try {
            localStorage.removeItem(key)
        } catch (e) {
            console.warn('Cache removing failed', e)
        }
    },

    // 인증 유저 정보 전용 (오프라인 UI 판정용)
    async setAuthUser(user: any) {
        await this.set('auth_last_user', user)
    },

    async getAuthUser() {
        return await this.get<any>('auth_last_user')
    },

    // 유저 프로필 정보 (닉네임 등)
    async setProfile(profile: any) {
        await this.set('auth_last_profile', profile)
    },

    async getProfile() {
        return await this.get<any>('auth_last_profile')
    },

    async clear() {
        if (!hasWindow()) return
        try {
            localStorage.clear()
        } catch (e) {
            console.warn('Cache clearing failed', e)
        }
    }
}
