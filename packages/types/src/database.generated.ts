export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_versions: {
        Row: {
          bundle_url: string
          channel: string | null
          created_at: string
          id: string
          is_active: boolean | null
          min_native_version: string | null
          version: string
        }
        Insert: {
          bundle_url: string
          channel?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          min_native_version?: string | null
          version: string
        }
        Update: {
          bundle_url?: string
          channel?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          min_native_version?: string | null
          version?: string
        }
        Relationships: []
      }
      checklist_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_assignees: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_assignees_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_user_checks: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_user_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_user_checks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          assigned_user_id: string | null
          assignment_type: string
          category: string
          checklist_id: string
          created_at: string
          id: string
          is_checked: boolean
          is_private: boolean | null
          item_name: string
          source_template_name: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          assignment_type?: string
          category?: string
          checklist_id: string
          created_at?: string
          id?: string
          is_checked?: boolean
          is_private?: boolean | null
          item_name: string
          source_template_name?: string | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          assignment_type?: string
          category?: string
          checklist_id?: string
          created_at?: string
          id?: string
          is_checked?: boolean
          is_private?: boolean | null
          item_name?: string
          source_template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          category: string
          created_at: string
          id: string
          is_private: boolean | null
          item_name: string
          template_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_private?: boolean | null
          item_name: string
          template_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_private?: boolean | null
          item_name?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_shares: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: string
          shared_with_user_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          shared_with_user_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          shared_with_user_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_shares_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          id: string
          title: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_urls: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_urls_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          address: string | null
          alarm_minutes_before: number | null
          alarm_sent_at: string | null
          cost: number | null
          created_at: string
          end_datetime_local: string
          google_place_id: string | null
          id: string
          image_url: string | null
          is_visited: boolean
          location: string | null
          location_lat: number | null
          location_lng: number | null
          memo: string | null
          photo_reference: string | null
          photo_unavailable: boolean
          start_datetime_local: string
          timezone_string: string
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          alarm_minutes_before?: number | null
          alarm_sent_at?: string | null
          cost?: number | null
          created_at?: string
          end_datetime_local: string
          google_place_id?: string | null
          id?: string
          image_url?: string | null
          is_visited?: boolean
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          memo?: string | null
          photo_reference?: string | null
          photo_unavailable?: boolean
          start_datetime_local: string
          timezone_string: string
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          alarm_minutes_before?: number | null
          alarm_sent_at?: string | null
          cost?: number | null
          created_at?: string
          end_datetime_local?: string
          google_place_id?: string | null
          id?: string
          image_url?: string | null
          is_visited?: boolean
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          memo?: string | null
          photo_reference?: string | null
          photo_unavailable?: boolean
          start_datetime_local?: string
          timezone_string?: string
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          created_at: string
          email: string | null
          id: string
          kakao_id: string | null
          nickname: string | null
          updated_at: string
        }
        Insert: {
          auth_provider?: string | null
          created_at?: string
          email?: string | null
          id: string
          kakao_id?: string | null
          nickname?: string | null
          updated_at?: string
        }
        Update: {
          auth_provider?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kakao_id?: string | null
          nickname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trip_invitation_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          token: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          token: string
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          token?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invitation_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_invitation_links_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          id: string
          invited_email: string
          role: string
          status: string
          trip_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email: string
          role?: string
          status?: string
          trip_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string
          role?: string
          status?: string
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          password_hash: string | null
          share_token: string
          share_type: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          share_token: string
          share_type?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          share_token?: string
          share_type?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_shares_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          adults_count: number | null
          bg_color: string | null
          children_count: number | null
          cover_image_ref: string | null
          created_at: string
          destination: string
          end_date: string
          id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adults_count?: number | null
          bg_color?: string | null
          children_count?: number | null
          cover_image_ref?: string | null
          created_at?: string
          destination: string
          end_date: string
          id?: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adults_count?: number | null
          bg_color?: string | null
          children_count?: number | null
          cover_image_ref?: string | null
          created_at?: string
          destination?: string
          end_date?: string
          id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string | null
          fcm_token: string
          id: string
          platform: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fcm_token: string
          id?: string
          platform?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fcm_token?: string
          id?: string
          platform?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_can_edit_template: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      check_can_view_template: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      check_is_public_trip: { Args: { _trip_id: string }; Returns: boolean }
      check_is_template_owner: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      check_is_trip_editor: {
        Args: { _trip_id: string; _user_id: string }
        Returns: boolean
      }
      check_is_trip_member: {
        Args: { _trip_id: string; _user_id: string }
        Returns: boolean
      }
      check_is_trip_owner: {
        Args: { _trip_id: string; _user_id: string }
        Returns: boolean
      }
      delete_user: { Args: never; Returns: undefined }
      generate_invitation_link: { Args: { p_trip_id: string }; Returns: string }
      get_pending_alarms: {
        Args: never
        Returns: {
          email: string
          fcm_tokens: string[]
          location: string
          plan_id: string
          timezone_string: string
          title: string
          trip_destination: string
          user_id: string
        }[]
      }
      get_trip_summary_by_token: { Args: { p_token: string }; Returns: Json }
      join_trip_via_token: { Args: { p_token: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
