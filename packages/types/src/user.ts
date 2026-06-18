export interface Profile {
  id: string
  email: string | null
  nickname: string | null
  auth_provider: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export interface UserDevice {
  id: string
  user_id: string
  fcm_token: string
  platform: 'ios' | 'android' | 'web'
  created_at: string
  updated_at: string
}
