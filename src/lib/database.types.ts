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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          reason: string | null
          target_id: string | null
          target_name: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          category: string
          created_at: string
          created_by: string
          display_name: string
          email: string | null
          event_id: string
          id: string
          notes: string | null
          party_size: number
          profile_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          display_name: string
          email?: string | null
          event_id: string
          id?: string
          notes?: string | null
          party_size?: number
          profile_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          display_name?: string
          email?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          party_size?: number
          profile_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_check_ins: {
        Row: {
          attendee_id: string
          checked_in_at: string
          checked_in_by: string
          created_at: string
          event_id: string
          id: string
          method: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
        }
        Insert: {
          attendee_id: string
          checked_in_at?: string
          checked_in_by: string
          created_at?: string
          event_id: string
          id?: string
          method?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
        }
        Update: {
          attendee_id?: string
          checked_in_at?: string
          checked_in_by?: string
          created_at?: string
          event_id?: string
          id?: string
          method?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_check_ins_attendee_event_fkey"
            columns: ["attendee_id", "event_id"]
            isOneToOne: false
            referencedRelation: "event_attendees"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      event_import_batches: {
        Row: {
          created_at: string
          created_count: number
          duplicate_skipped_count: number
          failed_count: number
          filename: string
          id: string
          imported_by: string | null
          total_rows: number
        }
        Insert: {
          created_at?: string
          created_count: number
          duplicate_skipped_count: number
          failed_count: number
          filename: string
          id?: string
          imported_by?: string | null
          total_rows: number
        }
        Update: {
          created_at?: string
          created_count?: number
          duplicate_skipped_count?: number
          failed_count?: number
          filename?: string
          id?: string
          imported_by?: string | null
          total_rows?: number
        }
        Relationships: []
      }
      event_submissions: {
        Row: {
          approved_event_id: string | null
          created_at: string
          dismissed_duplicate_ids: string[]
          duplicate_of_event_id: string | null
          edited_data: Json | null
          id: string
          internal_note: string | null
          rejection_message: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_data: Json
          submitter_email: string | null
          submitter_id: string | null
          submitter_name: string | null
          updated_at: string
        }
        Insert: {
          approved_event_id?: string | null
          created_at?: string
          dismissed_duplicate_ids?: string[]
          duplicate_of_event_id?: string | null
          edited_data?: Json | null
          id?: string
          internal_note?: string | null
          rejection_message?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_data: Json
          submitter_email?: string | null
          submitter_id?: string | null
          submitter_name?: string | null
          updated_at?: string
        }
        Update: {
          approved_event_id?: string | null
          created_at?: string
          dismissed_duplicate_ids?: string[]
          duplicate_of_event_id?: string | null
          edited_data?: Json | null
          id?: string
          internal_note?: string | null
          rejection_message?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_data?: Json
          submitter_email?: string | null
          submitter_id?: string | null
          submitter_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_submissions_approved_event_id_fkey"
            columns: ["approved_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_submissions_duplicate_of_event_id_fkey"
            columns: ["duplicate_of_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_taxonomy_terms: {
        Row: {
          event_id: string
          taxonomy_term_id: string
        }
        Insert: {
          event_id: string
          taxonomy_term_id: string
        }
        Update: {
          event_id?: string
          taxonomy_term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_taxonomy_terms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_taxonomy_terms_taxonomy_term_id_fkey"
            columns: ["taxonomy_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          cancellation_reason: string | null
          city: string | null
          contact_email: string | null
          contact_instagram: string | null
          contact_website: string | null
          created_at: string | null
          dance_styles: string[]
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string | null
          gallery: string[] | null
          host: string | null
          id: string
          image_url: string | null
          location: string | null
          organizer_id: string | null
          price_amount: number | null
          price_type: string | null
          recurrence: string | null
          rsvp_link: string | null
          source_type: string
          status: string | null
          submitter_email: string | null
          submitter_id: string | null
          submitter_name: string | null
          title: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          address?: string | null
          cancellation_reason?: string | null
          city?: string | null
          contact_email?: string | null
          contact_instagram?: string | null
          contact_website?: string | null
          created_at?: string | null
          dance_styles?: string[]
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string | null
          gallery?: string[] | null
          host?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          organizer_id?: string | null
          price_amount?: number | null
          price_type?: string | null
          recurrence?: string | null
          rsvp_link?: string | null
          source_type?: string
          status?: string | null
          submitter_email?: string | null
          submitter_id?: string | null
          submitter_name?: string | null
          title: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          address?: string | null
          cancellation_reason?: string | null
          city?: string | null
          contact_email?: string | null
          contact_instagram?: string | null
          contact_website?: string | null
          created_at?: string | null
          dance_styles?: string[]
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          gallery?: string[] | null
          host?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          organizer_id?: string | null
          price_amount?: number | null
          price_type?: string | null
          recurrence?: string | null
          rsvp_link?: string | null
          source_type?: string
          status?: string | null
          submitter_email?: string | null
          submitter_id?: string | null
          submitter_name?: string | null
          title?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_members: {
        Row: {
          created_at: string
          member_role: string
          organizer_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          member_role?: string
          organizer_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          member_role?: string
          organizer_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instagram: string | null
          organizer_type: string | null
          primary_city: string | null
          proposed_name: string | null
          proposed_organizer_id: string | null
          rejection_message: string | null
          rejection_reason_code: string | null
          request_message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          organizer_type?: string | null
          primary_city?: string | null
          proposed_name?: string | null
          proposed_organizer_id?: string | null
          rejection_message?: string | null
          rejection_reason_code?: string | null
          request_message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          organizer_type?: string | null
          primary_city?: string | null
          proposed_name?: string | null
          proposed_organizer_id?: string | null
          rejection_message?: string | null
          rejection_reason_code?: string | null
          request_message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizer_requests_proposed_organizer_id_fkey"
            columns: ["proposed_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          name: string
          organizer_type: string | null
          primary_city: string | null
          slug: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name: string
          organizer_type?: string | null
          primary_city?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name?: string
          organizer_type?: string | null
          primary_city?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          allow_public_event_suggestions: boolean
          allow_registered_user_submissions: boolean
          default_city: string
          default_country_code: string
          default_currency_code: string
          default_event_duration_minutes: number
          default_locale: string
          default_timezone: string
          platform_name: string
          public_site_url: string
          singleton: boolean
          support_email: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_public_event_suggestions: boolean
          allow_registered_user_submissions: boolean
          default_city: string
          default_country_code: string
          default_currency_code: string
          default_event_duration_minutes: number
          default_locale: string
          default_timezone: string
          platform_name: string
          public_site_url: string
          singleton?: boolean
          support_email: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_public_event_suggestions?: boolean
          allow_registered_user_submissions?: boolean
          default_city?: string
          default_country_code?: string
          default_currency_code?: string
          default_event_duration_minutes?: number
          default_locale?: string
          default_timezone?: string
          platform_name?: string
          public_site_url?: string
          singleton?: boolean
          support_email?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          role: string
          status: string
          status_reason: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          role?: string
          status?: string
          status_reason?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          status?: string
          status_reason?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      taxonomy_terms: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          normalized_name: string | null
          parent_id: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          normalized_name?: string | null
          parent_id?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          normalized_name?: string | null
          parent_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_terms_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string
          created_at: string
          id: string
          instagram: string | null
          latitude: number | null
          longitude: number | null
          name: string
          normalized_address: string | null
          normalized_name: string | null
          phone: string | null
          postal_code: string | null
          slug: string | null
          state_region: string | null
          status: string
          timezone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          normalized_address?: string | null
          normalized_name?: string | null
          phone?: string | null
          postal_code?: string | null
          slug?: string | null
          state_region?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          normalized_address?: string | null
          normalized_name?: string | null
          phone?: string | null
          postal_code?: string | null
          slug?: string | null
          state_region?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      audit_log_view: {
        Row: {
          action: string | null
          actor_avatar_url: string | null
          actor_display_name: string | null
          actor_id: string | null
          actor_username: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          metadata: Json | null
          reason: string | null
          target_id: string | null
          target_name: string | null
          target_type: string | null
        }
        Relationships: []
      }
      v_analytics_event_counts: {
        Row: {
          approved_count: number | null
          pending_count: number | null
          rejected_count: number | null
          rsvp_count: number | null
          total_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_is_active: { Args: { p_user_id: string }; Returns: boolean }
      admin_analytics_metrics: {
        Args: { from_date: string; to_date: string }
        Returns: Json
      }
      admin_analytics_timeseries: {
        Args: { from_date: string; granularity?: string; to_date: string }
        Returns: Json
      }
      admin_approve_organizer_request: {
        Args: {
          p_internal_note?: string
          p_request_id: string
          p_reviewer_id: string
        }
        Returns: undefined
      }
      admin_audit_log: {
        Args: {
          p_action?: string[]
          p_actor_id?: string
          p_category?: string[]
          p_entity_type?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_to?: string
        }
        Returns: {
          action: string
          actor_avatar_url: string
          actor_display_name: string
          actor_id: string
          actor_username: string
          after_state: Json
          before_state: Json
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          reason: string
          target_id: string
          target_name: string
          target_type: string
        }[]
      }
      admin_invite_user: {
        Args: { p_display_name?: string; p_email: string; p_role?: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          role: string
          status: string
          temp_password: string
          username: string
        }[]
      }
      admin_organizer_request_counts: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      admin_organizer_request_detail: {
        Args: { p_id: string }
        Returns: {
          applicant_approved_count: number
          applicant_avatar_url: string
          applicant_contributions: number
          applicant_created_at: string
          applicant_display_name: string
          applicant_email: string
          applicant_email_confirmed_at: string
          applicant_id: string
          applicant_kind: string
          applicant_pending_count: number
          applicant_role: string
          applicant_status: string
          applicant_status_reason: string
          applicant_user_id: string
          applicant_username: string
          created_at: string
          description: string
          id: string
          instagram: string
          organizer_type: string
          primary_city: string
          proposed_name: string
          proposed_organizer_id: string
          rejection_message: string
          rejection_reason_code: string
          request_message: string
          reviewed_at: string
          reviewed_by: string
          status: string
          updated_at: string
          website: string
        }[]
      }
      admin_organizer_requests: {
        Args: never
        Returns: {
          applicant_approved_count: number
          applicant_avatar_url: string
          applicant_contributions: number
          applicant_created_at: string
          applicant_display_name: string
          applicant_email: string
          applicant_email_confirmed_at: string
          applicant_id: string
          applicant_kind: string
          applicant_pending_count: number
          applicant_role: string
          applicant_status: string
          applicant_status_reason: string
          applicant_user_id: string
          applicant_username: string
          created_at: string
          description: string
          id: string
          instagram: string
          organizer_type: string
          primary_city: string
          proposed_name: string
          proposed_organizer_id: string
          rejection_message: string
          rejection_reason_code: string
          request_message: string
          reviewed_at: string
          reviewed_by: string
          status: string
          updated_at: string
          website: string
        }[]
      }
      admin_reject_organizer_request: {
        Args: {
          p_internal_note?: string
          p_reason_code: string
          p_reason_message?: string
          p_request_id: string
          p_reviewer_id: string
        }
        Returns: undefined
      }
      admin_revoke_organizer_access: {
        Args: {
          p_organizer_id: string
          p_reason?: string
          p_reviewer_id: string
        }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: { p_reason?: string; p_status: string; p_user_id: string }
        Returns: undefined
      }
      admin_taxonomy_detail: {
        Args: { p_id: string }
        Returns: {
          category: string
          created_at: string
          description: string
          display_order: number
          id: string
          name: string
          parent_id: string
          slug: string
          status: string
          updated_at: string
          usage_count: number
        }[]
      }
      admin_taxonomy_directory: {
        Args: {
          p_category?: string
          p_search?: string
          p_status?: string
          p_view?: string
        }
        Returns: {
          category: string
          description: string
          display_order: number
          id: string
          name: string
          parent_id: string
          slug: string
          status: string
          updated_at: string
          usage_count: number
        }[]
      }
      admin_taxonomy_search: {
        Args: { p_category: string; p_search?: string }
        Returns: {
          category: string
          id: string
          name: string
          slug: string
          status: string
        }[]
      }
      admin_user_directory: {
        Args: never
        Returns: {
          approved_count: number
          avatar_url: string
          contributions: number
          created_at: string
          display_name: string
          email: string
          email_confirmed_at: string
          id: string
          kind: string
          last_active_at: string
          pending_count: number
          role: string
          status: string
          status_reason: string
          user_id: string
          username: string
        }[]
      }
      admin_venue_detail: {
        Args: { p_id: string }
        Returns: {
          address_line1: string
          address_line2: string
          city: string
          country: string
          created_at: string
          id: string
          instagram: string
          latitude: number
          longitude: number
          name: string
          phone: string
          postal_code: string
          quality_issues: string[]
          slug: string
          state_region: string
          status: string
          timezone: string
          upcoming_count: number
          updated_at: string
          website: string
        }[]
      }
      admin_venue_directory: {
        Args: {
          p_city?: string[]
          p_has_upcoming?: boolean
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_state?: string[]
          p_status?: string[]
        }
        Returns: {
          address_line1: string
          address_line2: string
          city: string
          country: string
          created_at: string
          id: string
          instagram: string
          latitude: number
          longitude: number
          name: string
          phone: string
          postal_code: string
          quality_issues: string[]
          slug: string
          state_region: string
          status: string
          timezone: string
          upcoming_count: number
          updated_at: string
          website: string
        }[]
      }
      admin_venue_search: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          address_line1: string
          address_line2: string
          city: string
          country: string
          created_at: string
          id: string
          instagram: string
          latitude: number
          longitude: number
          name: string
          phone: string
          postal_code: string
          quality_issues: string[]
          slug: string
          state_region: string
          status: string
          timezone: string
          upcoming_count: number
          updated_at: string
          website: string
        }[]
      }
      approve_event_submission: {
        Args: { p_submission_id: string; p_taxonomy_term_ids: string[] }
        Returns: string
      }
      can_manage_event_attendance: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      category_of: {
        Args: { p_action: string; p_entity_type: string }
        Returns: string
      }
      is_active_organizer_member: {
        Args: { p_organizer_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_moderator: { Args: never; Returns: boolean }
      is_organizer: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      merge_taxonomy_terms: {
        Args: { p_keep_id: string; p_merge_id: string }
        Returns: undefined
      }
      merge_venues: {
        Args: { p_keep_id: string; p_merge_id: string }
        Returns: undefined
      }
      organizer_create_event: {
        Args: { p_organizer_id: string; p_payload: Json; p_publish?: boolean }
        Returns: string
      }
      organizer_member_role: {
        Args: { p_organizer_id: string }
        Returns: string
      }
      organizer_update_event: {
        Args: { p_event_id: string; p_payload: Json }
        Returns: undefined
      }
      public_event_suggestions_enabled: { Args: never; Returns: boolean }
      registered_event_submissions_enabled: { Args: never; Returns: boolean }
      replace_event_taxonomy_terms: {
        Args: { p_event_id: string; p_taxonomy_term_ids: string[] }
        Returns: undefined
      }
      require_taxonomy_moderator: { Args: never; Returns: undefined }
      slugify: { Args: { value: string }; Returns: string }
      venue_quality_issues: {
        Args: { p_venue: Database["public"]["Tables"]["venues"]["Row"] }
        Returns: string[]
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

