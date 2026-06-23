export interface ChecklistTemplate {
  id: string
  user_id: string | null   // null = 공개 템플릿
  title: string
  created_at: string
  source_template_name?: string | null
}

export type ChecklistTemplateShareRole = 'viewer' | 'editor'

export type ChecklistTemplateAccess = 'owner' | ChecklistTemplateShareRole | 'default'

export interface ChecklistTemplateShare {
  id: string
  template_id: string
  shared_with_user_id: string
  role: ChecklistTemplateShareRole
  created_by: string | null
  created_at: string
}

export interface ChecklistTemplateItem {
  id: string
  template_id: string
  item_name: string
  category: string
  is_private: boolean
  created_at: string
}

export interface TemplateItemInput {
  item_name: string
  category: string
  is_private?: boolean
}

export interface ChecklistTemplateWithAccess extends ChecklistTemplate {
  access: ChecklistTemplateAccess
  share_role: ChecklistTemplateShareRole | null
}

export interface ChecklistTemplateShareWithProfile extends ChecklistTemplateShare {
  profiles?: {
    nickname: string | null
    email: string | null
  } | null
}
