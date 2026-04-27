import { Preferences } from '@capacitor/preferences'

export const CacheUtil = {
    async set(key: string, value: any) {
        try {
            await Preferences.set({
                key,
                value: JSON.stringify(value)
            })
        } catch (e) {
            console.warn('Cache writing failed', e)
        }
    },
    
    async get<T>(key: string): Promise<T | null> {
        try {
            const { value } = await Preferences.get({ key })
            if (value) {
                return JSON.parse(value) as T
            }
        } catch (e) {
            console.warn('Cache reading failed', e)
        }
        return null
    },
    
    async remove(key: string) {
        try {
            await Preferences.remove({ key })
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
        try {
            await Preferences.clear()
            if (typeof window !== 'undefined') {
                localStorage.clear()
            }
        } catch (e) {
            console.warn('Cache clearing failed', e)
        }
    }
}
