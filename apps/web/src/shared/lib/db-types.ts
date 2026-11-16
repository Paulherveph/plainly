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
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          cache_read_tokens: number
          cache_write_tokens: number
          cost_micros_usd: number
          created_at: string
          credits_charged: number
          document_id: string | null
          error_kind: string | null
          id: number
          input_tokens: number
          latency_ms: number
          model: string
          output_tokens: number
          profile: string
          provider: string
          request_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          cost_micros_usd?: number
          created_at?: string
          credits_charged?: number
          document_id?: string | null
          error_kind?: string | null
          id?: never
          input_tokens?: number
          latency_ms?: number
          model: string
          output_tokens?: number
          profile: string
          provider: string
          request_id: string
          status: string
          user_id?: string | null
        }
        Update: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          cost_micros_usd?: number
          created_at?: string
          credits_charged?: number
          document_id?: string | null
          error_kind?: string | null
          id?: never
          input_tokens?: number
          latency_ms?: number
          model?: string
          output_tokens?: number
          profile?: string
          provider?: string
          request_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      analyses: {
        Row: {
          analysis_version: string
          created_at: string
          document_id: string
          dropped_claims: number
          id: string
          locale: string
          model: string
          result: Json
          user_id: string
        }
        Insert: {
          analysis_version?: string
          created_at?: string
          document_id: string
          dropped_claims?: number
          id?: string
          locale: string
          model: string
          result: Json
          user_id?: string
        }
        Update: {
          analysis_version?: string
          created_at?: string
          document_id?: string
          dropped_claims?: number
          id?: string
          locale?: string
          model?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_cache: {
        Row: {
          cache_key: string
          created_at: string
          dropped: number
          model: string
          result: Json
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          dropped?: number
          model: string
          result: Json
          user_id?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          dropped?: number
          model?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string
          id: number
          occurred_at: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: never
          occurred_at: string
          payload: Json
          processed_at?: string | null
          provider: string
          provider_event_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: never
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          type?: string
        }
        Relationships: []
      }
      credit_balances: {
        Row: {
          low_nudged: string | null
          pack_credits: number
          period_end: string | null
          period_key: string | null
          plan_credits: number
          plan_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          low_nudged?: string | null
          pack_credits?: number
          period_end?: string | null
          period_key?: string | null
          plan_credits?: number
          plan_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          low_nudged?: string | null
          pack_credits?: number
          period_end?: string | null
          period_key?: string | null
          plan_credits?: number
          plan_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_balances_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_holds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          pack_amount: number
          plan_amount: number
          status: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          pack_amount: number
          plan_amount: number
          status?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          pack_amount?: number
          plan_amount?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          bucket: string
          created_at: string
          delta: number
          id: number
          idempotency_key: string
          reason: string
          ref_id: string | null
          ref_type: string | null
          user_id: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          delta: number
          id?: never
          idempotency_key: string
          reason: string
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          delta?: number
          id?: never
          idempotency_key?: string
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          created_at: string
          detail: string | null
          document_id: string
          done: boolean
          due_on: string
          id: string
          label: string
          page: number | null
          quote: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          document_id: string
          done?: boolean
          due_on: string
          id?: string
          label: string
          page?: number | null
          quote: string
          user_id?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          document_id?: string
          done?: boolean
          due_on?: string
          id?: string
          label?: string
          page?: number | null
          quote?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_pages: {
        Row: {
          document_id: string
          needs_vision: boolean
          page: number
          text: string
          tsv: unknown
          user_id: string
        }
        Insert: {
          document_id: string
          needs_vision?: boolean
          page: number
          text: string
          tsv?: unknown
          user_id?: string
        }
        Update: {
          document_id?: string
          needs_vision?: boolean
          page?: number
          text?: string
          tsv?: unknown
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          chat_summary: string | null
          content_hash: string | null
          created_at: string
          expires_at: string
          extracted_text: string | null
          id: string
          kind: string | null
          media_type: string
          page_count: number
          sample_id: string | null
          source_lang: string | null
          status: string
          storage_path: string
          title: string
          user_id: string
          vision_pages: number[]
        }
        Insert: {
          chat_summary?: string | null
          content_hash?: string | null
          created_at?: string
          expires_at?: string
          extracted_text?: string | null
          id?: string
          kind?: string | null
          media_type: string
          page_count?: number
          sample_id?: string | null
          source_lang?: string | null
          status?: string
          storage_path: string
          title: string
          user_id?: string
          vision_pages?: number[]
        }
        Update: {
          chat_summary?: string | null
          content_hash?: string | null
          created_at?: string
          expires_at?: string
          extracted_text?: string | null
          id?: string
          kind?: string | null
          media_type?: string
          page_count?: number
          sample_id?: string | null
          source_lang?: string | null
          status?: string
          storage_path?: string
          title?: string
          user_id?: string
          vision_pages?: number[]
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          document_id: string | null
          error_kind: string | null
          id: string
          idempotency_key: string
          kind: string
          locale: string | null
          request_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          error_kind?: string | null
          id?: string
          idempotency_key: string
          kind: string
          locale?: string | null
          request_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          error_kind?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          locale?: string | null
          request_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          document: string
          id: number
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document: string
          id?: never
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document?: string
          id?: never
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          document_id: string
          id: string
          parts: Json
          question_hash: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          parts: Json
          question_hash?: string | null
          role: string
          user_id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          parts?: Json
          question_hash?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          currency: string
          entitlements: Json
          id: string
          interval: string
          kind: string
          name: string
          price_cents: number
          sort: number
        }
        Insert: {
          active?: boolean
          currency?: string
          entitlements: Json
          id: string
          interval?: string
          kind: string
          name: string
          price_cents?: number
          sort?: number
        }
        Update: {
          active?: boolean
          currency?: string
          entitlements?: Json
          id?: string
          interval?: string
          kind?: string
          name?: string
          price_cents?: number
          sort?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string | null
          locale: string
          plan_id: string | null
          theme: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          locale?: string
          plan_id?: string | null
          theme?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          locale?: string
          plan_id?: string | null
          theme?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          last_event_at: string | null
          past_due_since: string | null
          plan_id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          last_event_at?: string | null
          past_due_since?: string | null
          plan_id: string
          provider: string
          provider_customer_id?: string | null
          provider_subscription_id: string
          status: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          last_event_at?: string | null
          past_due_since?: string | null
          plan_id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_overview: {
        Row: {
          approved: boolean | null
          created_at: string | null
          credits: number | null
          documents: number | null
          email: string | null
          guest: boolean | null
          last_sign_in_at: string | null
          plan: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_legal: {
        Args: { p_privacy: string; p_terms: string }
        Returns: undefined
      }
      admin_stats: {
        Args: never
        Returns: {
          active_subscriptions: number
          analyses_today: number
          failed_24h: number
          fallbacks_24h: number
          requests_24h: number
          spend_today_micros: number
        }[]
      }
      ai_spend_today: { Args: never; Returns: number }
      delete_stale_guests: { Args: { p_days?: number }; Returns: number }
      effective_plan: { Args: { p_user: string }; Returns: string }
      grant_pack_credits: {
        Args: { p_credits: number; p_key: string; p_user: string }
        Returns: boolean
      }
      grant_period_credits: { Args: { p_user: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      mark_low_nudged: { Args: never; Returns: undefined }
      merge_guest: {
        Args: { p_guest: string; p_user: string }
        Returns: number
      }
      my_credits: {
        Args: never
        Returns: {
          email_verified: boolean
          low_nudged: string
          pack_credits: number
          period_end: string
          period_key: string
          plan_credits: number
          plan_id: string
          plan_total: number
        }[]
      }
      my_plan: {
        Args: never
        Returns: {
          email_verified: boolean
          entitlements: Json
          plan_id: string
        }[]
      }
      my_recent_activity: {
        Args: never
        Returns: {
          requests_last_minute: number
          running_analyses: number
        }[]
      }
      owns_document: { Args: { p_document_id: string }; Returns: boolean }
      record_ai_usage: {
        Args: {
          p_cache_read_tokens: number
          p_cache_write_tokens: number
          p_cost_micros_usd: number
          p_document_id: string
          p_error_kind: string
          p_input_tokens: number
          p_latency_ms: number
          p_model: string
          p_output_tokens: number
          p_profile: string
          p_provider: string
          p_request_id: string
          p_status: string
        }
        Returns: undefined
      }
      release_credits: { Args: { p_hold: string }; Returns: undefined }
      reserve_credits: {
        Args: { p_amount: number; p_key: string }
        Returns: {
          available: number
          hold_id: string
        }[]
      }
      reverse_credits: {
        Args: {
          p_bucket: string
          p_credits: number
          p_key: string
          p_user: string
        }
        Returns: number
      }
      search_document_pages: {
        Args: { p_document_id: string; p_limit?: number; p_query: string }
        Returns: {
          page: number
          text: string
        }[]
      }
      settle_credits: {
        Args: { p_final: number; p_hold: string }
        Returns: undefined
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

