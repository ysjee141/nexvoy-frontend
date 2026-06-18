export interface ChecklistTemplate {
  id: string
  user_id: string | null   // null = 공개 템플릿
  title: string
  created_at: string
  source_template_name?: string | null
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
