export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      applied_operations: {
        Row: {
          actor_id: string
          applied_at: string
          canonical_change: Json
          command_hash: string
          operation_id: string
          resource_id: string
          resource_type: string
          revision: number
        }
        Insert: {
          actor_id: string
          applied_at?: string
          canonical_change: Json
          command_hash: string
          operation_id: string
          resource_id: string
          resource_type: string
          revision: number
        }
        Update: {
          actor_id?: string
          applied_at?: string
          canonical_change?: Json
          command_hash?: string
          operation_id?: string
          resource_id?: string
          resource_type?: string
          revision?: number
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
          deleted_at: string | null
          id: string
          item_id: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id?: string
          updated_at?: string
          user_id?: string
          version?: number
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
          deleted_at: string | null
          id: string
          item_id: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id?: string
          updated_at?: string
          user_id?: string
          version?: number
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
          deleted_at: string | null
          id: string
          is_checked: boolean
          is_private: boolean
          item_name: string
          sort_key: string | null
          source_template_name: string | null
          updated_at: string
          version: number
        }
        Insert: {
          assigned_user_id?: string | null
          assignment_type?: string
          category?: string
          checklist_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_checked?: boolean
          is_private?: boolean
          item_name: string
          sort_key?: string | null
          source_template_name?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_user_id?: string | null
          assignment_type?: string
          category?: string
          checklist_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_checked?: boolean
          is_private?: boolean
          item_name?: string
          sort_key?: string | null
          source_template_name?: string | null
          updated_at?: string
          version?: number
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
          deleted_at: string | null
          id: string
          is_private: boolean
          item_name: string
          sort_key: string | null
          template_id: string
          updated_at: string
          version: number
        }
        Insert: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_private?: boolean
          item_name: string
          sort_key?: string | null
          template_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_private?: boolean
          item_name?: string
          sort_key?: string | null
          template_id?: string
          updated_at?: string
          version?: number
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
          deleted_at: string | null
          id: string
          role: string
          shared_with_user_id: string
          template_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          role?: string
          shared_with_user_id: string
          template_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          role?: string
          shared_with_user_id?: string
          template_id?: string
          updated_at?: string
          version?: number
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
          deleted_at: string | null
          id: string
          title: string
          updated_at: string
          user_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          version?: number
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
          deleted_at: string | null
          id: string
          title: string
          trip_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          title: string
          trip_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          title?: string
          trip_id?: string
          updated_at?: string
          version?: number
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
      document_devices: {
        Row: {
          created_at: string
          device_id: string
          document_id: string
          id: string
          last_seen_at: string | null
          last_synced_seq: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          document_id: string
          id?: string
          last_seen_at?: string | null
          last_synced_seq?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          document_id?: string
          id?: string
          last_seen_at?: string | null
          last_synced_seq?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_devices_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_invitation_links: {
        Row: {
          created_at: string
          created_by: string
          destination: string | null
          document_id: string
          end_date: string | null
          expires_at: string | null
          id: string
          invitation_kind: string
          invite_code_hash: string | null
          max_uses: number | null
          revoked_at: string | null
          role: string
          start_date: string | null
          target_email: string | null
          token_hash: string
          updated_at: string
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          destination?: string | null
          document_id: string
          end_date?: string | null
          expires_at?: string | null
          id?: string
          invitation_kind?: string
          invite_code_hash?: string | null
          max_uses?: number | null
          revoked_at?: string | null
          role: string
          start_date?: string | null
          target_email?: string | null
          token_hash: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          destination?: string | null
          document_id?: string
          end_date?: string | null
          expires_at?: string | null
          id?: string
          invitation_kind?: string
          invite_code_hash?: string | null
          max_uses?: number | null
          revoked_at?: string | null
          role?: string
          start_date?: string | null
          target_email?: string | null
          token_hash?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_invitation_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_invitation_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_key_provisioning_requests: {
        Row: {
          attempt_count: number
          cancelled_at: string | null
          device_id: string | null
          document_id: string
          error_code: string | null
          failed_at: string | null
          fulfilled_at: string | null
          id: string
          key_version: number
          material_id: string | null
          processing_started_at: string | null
          requested_at: string
          requested_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          cancelled_at?: string | null
          device_id?: string | null
          document_id: string
          error_code?: string | null
          failed_at?: string | null
          fulfilled_at?: string | null
          id?: string
          key_version?: number
          material_id?: string | null
          processing_started_at?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          cancelled_at?: string | null
          device_id?: string | null
          document_id?: string
          error_code?: string | null
          failed_at?: string | null
          fulfilled_at?: string | null
          id?: string
          key_version?: number
          material_id?: string | null
          processing_started_at?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_key_provisioning_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_key_provisioning_requests_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "user_key_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_key_provisioning_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_key_provisioning_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_keys: {
        Row: {
          created_at: string
          device_id: string | null
          document_id: string
          id: string
          key_version: number
          material_id: string | null
          recipient_scope: string
          revoked_at: string | null
          user_id: string
          wrapped_dek: string
          wrapping_alg: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          document_id: string
          id?: string
          key_version: number
          material_id?: string | null
          recipient_scope?: string
          revoked_at?: string | null
          user_id: string
          wrapped_dek: string
          wrapping_alg: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          document_id?: string
          id?: string
          key_version?: number
          material_id?: string | null
          recipient_scope?: string
          revoked_at?: string | null
          user_id?: string
          wrapped_dek?: string
          wrapping_alg?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_keys_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_keys_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "user_key_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_members: {
        Row: {
          created_at: string
          document_id: string
          id: string
          invited_email: string | null
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          invited_email?: string | null
          role: string
          status: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          invited_email?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_members_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_share_tokens: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          expires_at: string | null
          id: string
          password_hash: string | null
          revoked_at: string | null
          share_type: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id: string
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          revoked_at?: string | null
          share_type?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          revoked_at?: string | null
          share_type?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_share_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_share_tokens_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signaling_room_topics: {
        Row: {
          active_from: string
          created_at: string
          created_by: string | null
          document_id: string
          expires_at: string
          id: string
          revoked_at: string | null
          room_topic: string
        }
        Insert: {
          active_from?: string
          created_at?: string
          created_by?: string | null
          document_id: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          room_topic: string
        }
        Update: {
          active_from?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          room_topic?: string
        }
        Relationships: []
      }
      document_updates: {
        Row: {
          client_id: string
          created_at: string
          document_id: string
          id: string
          seq: number
          update_blob: string
          update_hash: string
        }
        Insert: {
          client_id: string
          created_at?: string
          document_id: string
          id?: string
          seq: number
          update_blob: string
          update_hash: string
        }
        Update: {
          client_id?: string
          created_at?: string
          document_id?: string
          id?: string
          seq?: number
          update_blob?: string
          update_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_updates_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          encrypted: boolean
          id: string
          owner_id: string
          schema_version: number
          snapshot: string | null
          snapshot_hash: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted?: boolean
          id: string
          owner_id: string
          schema_version: number
          snapshot?: string | null
          snapshot_hash?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted?: boolean
          id?: string
          owner_id?: string
          schema_version?: number
          snapshot?: string | null
          snapshot_hash?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_row_map: {
        Row: {
          created_at: string
          document_id: string
          id: string
          path_in_document: string
          row_id: string
          table_name: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          path_in_document: string
          row_id: string
          table_name: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          path_in_document?: string
          row_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_row_map_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_id: string | null
          batch_key: string | null
          body_key: string
          created_at: string
          dedupe_key: string
          delivered_at: string | null
          delivered_device_count: number
          document_id: string
          event_type: string
          failed_at: string | null
          failure_code: string | null
          id: string
          metadata: Json
          processing_started_at: string | null
          scheduled_after: string
          skipped_at: string | null
          status: string
          target_user_ids: string[]
          title_key: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          batch_key?: string | null
          body_key: string
          created_at?: string
          dedupe_key: string
          delivered_at?: string | null
          delivered_device_count?: number
          document_id: string
          event_type: string
          failed_at?: string | null
          failure_code?: string | null
          id?: string
          metadata?: Json
          processing_started_at?: string | null
          scheduled_after?: string
          skipped_at?: string | null
          status?: string
          target_user_ids: string[]
          title_key: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          batch_key?: string | null
          body_key?: string
          created_at?: string
          dedupe_key?: string
          delivered_at?: string | null
          delivered_device_count?: number
          document_id?: string
          event_type?: string
          failed_at?: string | null
          failure_code?: string | null
          id?: string
          metadata?: Json
          processing_started_at?: string | null
          scheduled_after?: string
          skipped_at?: string | null
          status?: string
          target_user_ids?: string[]
          title_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_urls: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          plan_id: string
          sort_key: string | null
          updated_at: string
          url: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          plan_id: string
          sort_key?: string | null
          updated_at?: string
          url: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          plan_id?: string
          sort_key?: string | null
          updated_at?: string
          url?: string
          version?: number
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
          deleted_at: string | null
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
          sort_key: string | null
          start_datetime_local: string
          timezone_string: string
          title: string
          trip_id: string
          updated_at: string
          version: number
        }
        Insert: {
          address?: string | null
          alarm_minutes_before?: number | null
          alarm_sent_at?: string | null
          cost?: number | null
          created_at?: string
          deleted_at?: string | null
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
          sort_key?: string | null
          start_datetime_local: string
          timezone_string: string
          title: string
          trip_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          address?: string | null
          alarm_minutes_before?: number | null
          alarm_sent_at?: string | null
          cost?: number | null
          created_at?: string
          deleted_at?: string | null
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
          sort_key?: string | null
          start_datetime_local?: string
          timezone_string?: string
          title?: string
          trip_id?: string
          updated_at?: string
          version?: number
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
          nickname: string | null
          updated_at: string
        }
        Insert: {
          auth_provider?: string | null
          created_at?: string
          email?: string | null
          id: string
          nickname?: string | null
          updated_at?: string
        }
        Update: {
          auth_provider?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nickname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      template_authority_state: {
        Row: {
          changed_entities: Json
          revision: number
          template_id: string
          updated_at: string
        }
        Insert: {
          changed_entities?: Json
          revision?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          changed_entities?: Json
          revision?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_authority_state_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_asset_objects: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          object_path: string
          plan_id: string | null
          trip_id: string
          user_id: string
          width: number | null
        }
        Insert: {
          bucket_id?: string
          created_at?: string
          id?: string
          object_path: string
          plan_id?: string | null
          trip_id: string
          user_id: string
          width?: number | null
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          object_path?: string
          plan_id?: string | null
          trip_id?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      trip_authority_state: {
        Row: {
          changed_entities: Json
          revision: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          changed_entities?: Json
          revision?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          changed_entities?: Json
          revision?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_authority_state_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
          destination: string
          end_date: string
          id: string
          start_date: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          adults_count?: number | null
          bg_color?: string | null
          children_count?: number | null
          cover_image_ref?: string | null
          created_at?: string
          deleted_at?: string | null
          destination: string
          end_date: string
          id?: string
          start_date: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          adults_count?: number | null
          bg_color?: string | null
          children_count?: number | null
          cover_image_ref?: string | null
          created_at?: string
          deleted_at?: string | null
          destination?: string
          end_date?: string
          id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
          version?: number
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
          device_id: string | null
          fcm_token: string
          id: string
          invalidated_at: string | null
          invalidation_reason: string | null
          last_seen_at: string | null
          platform: string | null
          provider: string
          revoked_at: string | null
          token_status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          fcm_token: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          last_seen_at?: string | null
          platform?: string | null
          provider?: string
          revoked_at?: string | null
          token_status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          fcm_token?: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          last_seen_at?: string | null
          platform?: string | null
          provider?: string
          revoked_at?: string | null
          token_status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_key_materials: {
        Row: {
          attestation_status: string
          created_at: string
          device_id: string
          hardware_backed: boolean | null
          id: string
          last_seen_at: string | null
          material_type: string
          material_version: number
          platform: string
          public_key_jwk: Json
          revoked_at: string | null
          status: string
          updated_at: string
          user_id: string
          wrapping_alg: string
        }
        Insert: {
          attestation_status?: string
          created_at?: string
          device_id: string
          hardware_backed?: boolean | null
          id?: string
          last_seen_at?: string | null
          material_type?: string
          material_version?: number
          platform?: string
          public_key_jwk: Json
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wrapping_alg: string
        }
        Update: {
          attestation_status?: string
          created_at?: string
          device_id?: string
          hardware_backed?: boolean | null
          id?: string
          last_seen_at?: string | null
          material_type?: string
          material_version?: number
          platform?: string
          public_key_jwk?: Json
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wrapping_alg?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_key_materials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_document_invitation: {
        Args: { p_invite_code?: string; p_token?: string }
        Returns: Json
      }
      accept_document_invitation_unchecked: {
        Args: { p_invite_code?: string; p_token?: string }
        Returns: Json
      }
      accept_my_document_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      apply_one_template_authority_command: {
        Args: { p_actor_id: string; p_command: Json; p_template_id: string }
        Returns: Json
      }
      apply_one_trip_authority_command: {
        Args: { p_actor_id: string; p_command: Json; p_trip_id: string }
        Returns: Json
      }
      apply_template_authority_commands: {
        Args: {
          p_base_revision?: number
          p_commands: Json
          p_template_id: string
        }
        Returns: Json
      }
      apply_template_commands: {
        Args: {
          p_base_revision?: number
          p_commands: Json
          p_template_id: string
        }
        Returns: Json
      }
      apply_trip_authority_commands: {
        Args: { p_base_revision?: number; p_commands: Json; p_trip_id: string }
        Returns: Json
      }
      apply_trip_commands: {
        Args: { p_base_revision?: number; p_commands: Json; p_trip_id: string }
        Returns: Json
      }
      assert_targeted_invitation_recipient: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      begin_document_key_provisioning: {
        Args: { p_request_id: string }
        Returns: Json
      }
      bootstrap_owner_document: {
        Args: {
          p_document_id: string
          p_schema_version?: number
          p_type: string
        }
        Returns: Json
      }
      bump_authority_revision_for_membership: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      can_receive_authority_topic: {
        Args: { p_topic: string; p_user_id: string }
        Returns: boolean
      }
      can_receive_document_signaling_topic: {
        Args: { p_room_topic: string; p_user_id: string }
        Returns: boolean
      }
      can_send_document_signaling_topic: {
        Args: { p_room_topic: string; p_user_id: string }
        Returns: boolean
      }
      check_can_edit_template: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      check_can_manage_checklist: {
        Args: { _checklist_id: string; _user_id: string }
        Returns: boolean
      }
      check_can_manage_checklist_item: {
        Args: { _item_id: string; _user_id: string }
        Returns: boolean
      }
      check_can_read_authority_template: {
        Args: { p_template_id: string; p_user_id: string }
        Returns: boolean
      }
      check_can_read_authority_trip: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      check_can_view_checklist: {
        Args: { _checklist_id: string; _user_id: string }
        Returns: boolean
      }
      check_can_view_checklist_item: {
        Args: { _item_id: string; _user_id: string }
        Returns: boolean
      }
      check_can_view_template: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      check_can_write_authority_template: {
        Args: { p_template_id: string; p_user_id: string }
        Returns: boolean
      }
      check_can_write_authority_trip: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      check_is_document_editor: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      check_is_document_member: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      check_is_document_owner: {
        Args: { _document_id: string; _user_id: string }
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
      cleanup_current_user_push_tokens: {
        Args: { p_device_id?: string }
        Returns: number
      }
      cleanup_document_notification_state: {
        Args: { p_document_id: string; p_user_id: string }
        Returns: number
      }
      complete_document_key_provisioning: {
        Args: {
          p_key_version?: number
          p_request_id: string
          p_wrapped_dek: string
          p_wrapping_alg: string
        }
        Returns: Json
      }
      create_document_invitation_link: {
        Args: {
          p_destination?: string
          p_document_id: string
          p_end_date?: string
          p_expires_at?: string
          p_max_uses?: number
          p_role: string
          p_start_date?: string
          p_target_email?: string
        }
        Returns: Json
      }
      create_document_invitation_link_legacy: {
        Args: {
          p_document_id: string
          p_expires_at?: string
          p_max_uses?: number
          p_role: string
        }
        Returns: Json
      }
      create_document_share_token: {
        Args: {
          p_document_id: string
          p_expires_at?: string
          p_password?: string
          p_share_type?: string
        }
        Returns: Json
      }
      decline_my_document_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      delete_user: { Args: never; Returns: undefined }
      document_registry_hash: { Args: { _value: string }; Returns: string }
      enqueue_key_provisioning_notification: {
        Args: {
          p_actor_id: string
          p_document_id: string
          p_reason_code: string
        }
        Returns: undefined
      }
      enqueue_notification_event: {
        Args: {
          p_client_dedupe_key?: string
          p_document_id: string
          p_event_type: string
          p_metadata?: Json
        }
        Returns: Json
      }
      find_profile_by_email: {
        Args: { _email: string }
        Returns: {
          auth_provider: string
          created_at: string
          email: string
          id: string
          nickname: string
          updated_at: string
        }[]
      }
      generate_invitation_link: { Args: { p_trip_id: string }; Returns: string }
      get_document_invitation_summary: {
        Args: { p_invite_code?: string; p_token?: string }
        Returns: Json
      }
      get_document_share_token_plans: {
        Args: { p_password?: string; p_share_token: string }
        Returns: Json
      }
      get_document_share_token_summary: {
        Args: { p_share_token: string }
        Returns: Json
      }
      get_my_active_document_key: {
        Args: {
          p_device_id?: string
          p_document_id: string
          p_key_version?: number
        }
        Returns: Json
      }
      get_my_document_key_provisioning_status: {
        Args: {
          p_device_id: string
          p_document_id: string
          p_key_version?: number
        }
        Returns: Json
      }
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
      get_template_authority_bundle: {
        Args: { p_template_id: string }
        Returns: Json
      }
      get_template_authority_changes: {
        Args: { p_entities: Json; p_revision: number; p_template_id: string }
        Returns: Json
      }
      get_template_authority_revision: {
        Args: { p_template_id: string }
        Returns: number
      }
      get_trip_authority_bundle: { Args: { p_trip_id: string }; Returns: Json }
      get_trip_authority_changes: {
        Args: { p_entities: Json; p_revision: number; p_trip_id: string }
        Returns: Json
      }
      get_trip_authority_revision: {
        Args: { p_trip_id: string }
        Returns: number
      }
      get_trip_summary_by_token: { Args: { p_token: string }; Returns: Json }
      has_active_document_key_for_device: {
        Args: {
          p_device_id?: string
          p_document_id: string
          p_key_version?: number
          p_user_id: string
        }
        Returns: boolean
      }
      is_template_authority_resource: {
        Args: { p_template_id: string }
        Returns: boolean
      }
      is_trip_authority_checklist: {
        Args: { p_checklist_id: string }
        Returns: boolean
      }
      is_trip_authority_checklist_item: {
        Args: { p_item_id: string }
        Returns: boolean
      }
      is_trip_authority_plan: { Args: { p_plan_id: string }; Returns: boolean }
      is_trip_authority_resource: {
        Args: { p_trip_id: string }
        Returns: boolean
      }
      issue_document_signaling_room_topic: {
        Args: { p_document_id: string }
        Returns: {
          expires_at: string
          room_topic: string
        }[]
      }
      join_trip_via_token: { Args: { p_token: string }; Returns: string }
      list_document_collaborators: {
        Args: { p_document_id: string }
        Returns: Json[]
      }
      list_document_pending_invitations: {
        Args: { p_document_id: string }
        Returns: Json[]
      }
      list_my_pending_document_invitations: { Args: never; Returns: Json[] }
      list_my_template_authority_summaries: { Args: never; Returns: Json }
      list_my_trip_authority_summaries: { Args: never; Returns: Json }
      list_orphan_place_photo_assets: {
        Args: { p_retention?: string }
        Returns: {
          asset_id: string
          bucket_id: string
          object_path: string
        }[]
      }
      list_pending_document_key_provisioning_requests: {
        Args: { p_document_id?: string; p_limit?: number }
        Returns: {
          attempt_count: number
          device_id: string
          document_id: string
          error_code: string
          id: string
          key_version: number
          material_id: string
          material_version: number
          member_role: string
          public_key_jwk: Json
          requested_at: string
          status: string
          updated_at: string
          user_id: string
          wrapping_alg: string
        }[]
      }
      list_pending_notification_events: {
        Args: { p_limit?: number }
        Returns: {
          body_key: string
          document_id: string
          event_type: string
          id: string
          metadata: Json
          target_devices: Json
          title_key: string
          trip_id: string
        }[]
      }
      mark_document_key_provisioning_failed: {
        Args: { p_error_code: string; p_request_id: string }
        Returns: Json
      }
      mark_notification_event_delivered: {
        Args: { p_device_count?: number; p_event_id: string }
        Returns: undefined
      }
      mark_notification_event_failed: {
        Args: { p_event_id: string; p_failure_code: string }
        Returns: undefined
      }
      mark_notification_event_skipped: {
        Args: { p_event_id: string; p_reason_code: string }
        Returns: undefined
      }
      notification_body_key_for_event: {
        Args: { p_event_type: string }
        Returns: string
      }
      notification_title_key_for_event: {
        Args: { p_event_type: string }
        Returns: string
      }
      register_place_photo_asset: {
        Args: {
          p_bucket_id?: string
          p_object_path: string
          p_plan_id: string
          p_trip_id: string
          p_width: number
        }
        Returns: string
      }
      register_user_key_material: {
        Args: {
          p_attestation_status?: string
          p_device_id: string
          p_hardware_backed?: boolean
          p_material_type?: string
          p_material_version?: number
          p_platform?: string
          p_public_key_jwk: Json
          p_wrapping_alg: string
        }
        Returns: Json
      }
      request_document_key_provisioning: {
        Args: {
          p_device_id: string
          p_document_id: string
          p_key_version?: number
        }
        Returns: Json
      }
      revoke_document_invitation_link: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      revoke_document_member: { Args: { p_member_id: string }; Returns: Json }
      revoke_document_share_token: {
        Args: { p_share_token_id: string }
        Returns: undefined
      }
      revoke_trip_document_member: {
        Args: { p_trip_member_id: string }
        Returns: Json
      }
      revoke_user_key_material: {
        Args: { p_device_id: string; p_material_version?: number }
        Returns: Json
      }
      sanitize_key_provisioning_error_code: {
        Args: { p_error_code: string }
        Returns: string
      }
      sanitize_notification_metadata: {
        Args: { p_metadata: Json }
        Returns: Json
      }
      set_document_member_role: {
        Args: { p_member_id: string; p_role: string }
        Returns: undefined
      }
      set_trip_document_member_role: {
        Args: { p_role: string; p_trip_member_id: string }
        Returns: undefined
      }
      upsert_key_provisioning_requests_for_user: {
        Args: {
          p_document_id: string
          p_key_version?: number
          p_requested_by?: string
          p_user_id: string
        }
        Returns: number
      }
      upsert_owner_document_key: {
        Args: {
          p_device_id?: string
          p_document_id: string
          p_key_version?: number
          p_material_version?: number
          p_wrapped_dek: string
          p_wrapping_alg: string
        }
        Returns: Json
      }
      verify_document_share_token: {
        Args: { p_password: string; p_share_token: string }
        Returns: Json
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

