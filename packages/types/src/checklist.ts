export interface Checklist {
  id: string
  trip_id: string
  title: string
  created_at: string
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  item_name: string
  category: string
  is_checked: boolean
  is_private: boolean
  assignment_type: 'anyone' | 'specific' | 'everyone'
  assigned_user_id: string | null
  source_template_name: string | null
  created_at: string
  updated_at: string
}
