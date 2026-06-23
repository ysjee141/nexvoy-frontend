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

export interface ChecklistCategory {
  id: string
  user_id: string | null
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ChecklistItemAssignee {
  id: string
  item_id: string
  user_id: string
  created_at: string
}

export interface ChecklistItemUserCheck {
  id: string
  item_id: string
  user_id: string
  created_at: string
}

export interface ChecklistItemWithMeta extends ChecklistItem {
  assignees?: ChecklistItemAssignee[]
  user_checks?: ChecklistItemUserCheck[]
}

export interface ChecklistItemStatus {
  is_checked: boolean
  is_my_checked: boolean
  checks_count: number
  required_count: number
  can_check: boolean
}
