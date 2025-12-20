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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      call_appointments: {
        Row: {
          additional_comments: string | null
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          cash_received: number | null
          closer_id: string
          closer_remarks: string | null
          created_at: string
          created_by: string | null
          due_amount: number | null
          id: string
          lead_id: string
          offer_amount: number | null
          scheduled_date: string
          scheduled_time: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
          zoom_link: string | null
        }
        Insert: {
          additional_comments?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          cash_received?: number | null
          closer_id: string
          closer_remarks?: string | null
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          id?: string
          lead_id: string
          offer_amount?: number | null
          scheduled_date: string
          scheduled_time: string
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
          zoom_link?: string | null
        }
        Update: {
          additional_comments?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          cash_received?: number | null
          closer_id?: string
          closer_remarks?: string | null
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          id?: string
          lead_id?: string
          offer_amount?: number | null
          scheduled_date?: string
          scheduled_time?: string
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_appointments_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      call_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          reminder_time: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"] | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          reminder_time: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          reminder_time?: string
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "call_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "call_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_onboarding: {
        Row: {
          age_group: string | null
          annual_revenue: string | null
          area_type: string | null
          business_type: string | null
          business_years: string | null
          city: string | null
          company_size: string | null
          completed_at: string | null
          country: string | null
          created_at: string
          current_step: number | null
          date_of_birth: string | null
          decision_factors: string[] | null
          dependents: string | null
          education_level: string | null
          email: string
          field_of_study: string | null
          full_name: string
          gender: string | null
          id: string
          income_source: string | null
          industry: string | null
          interests: string[] | null
          job_title: string | null
          lead_id: string | null
          marital_status: string | null
          marketing_consent: boolean | null
          monthly_budget: string | null
          monthly_income: string | null
          occupation: string | null
          phone: string | null
          preferred_communication: string | null
          preferred_contact_time: string | null
          primary_goal: string | null
          referral_source: string | null
          state: string | null
          team_size: string | null
          terms_accepted: boolean | null
          updated_at: string
          years_experience: string | null
        }
        Insert: {
          age_group?: string | null
          annual_revenue?: string | null
          area_type?: string | null
          business_type?: string | null
          business_years?: string | null
          city?: string | null
          company_size?: string | null
          completed_at?: string | null
          country?: string | null
          created_at?: string
          current_step?: number | null
          date_of_birth?: string | null
          decision_factors?: string[] | null
          dependents?: string | null
          education_level?: string | null
          email: string
          field_of_study?: string | null
          full_name: string
          gender?: string | null
          id?: string
          income_source?: string | null
          industry?: string | null
          interests?: string[] | null
          job_title?: string | null
          lead_id?: string | null
          marital_status?: string | null
          marketing_consent?: boolean | null
          monthly_budget?: string | null
          monthly_income?: string | null
          occupation?: string | null
          phone?: string | null
          preferred_communication?: string | null
          preferred_contact_time?: string | null
          primary_goal?: string | null
          referral_source?: string | null
          state?: string | null
          team_size?: string | null
          terms_accepted?: boolean | null
          updated_at?: string
          years_experience?: string | null
        }
        Update: {
          age_group?: string | null
          annual_revenue?: string | null
          area_type?: string | null
          business_type?: string | null
          business_years?: string | null
          city?: string | null
          company_size?: string | null
          completed_at?: string | null
          country?: string | null
          created_at?: string
          current_step?: number | null
          date_of_birth?: string | null
          decision_factors?: string[] | null
          dependents?: string | null
          education_level?: string | null
          email?: string
          field_of_study?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          income_source?: string | null
          industry?: string | null
          interests?: string[] | null
          job_title?: string | null
          lead_id?: string | null
          marital_status?: string | null
          marketing_consent?: boolean | null
          monthly_budget?: string | null
          monthly_income?: string | null
          occupation?: string | null
          phone?: string | null
          preferred_communication?: string | null
          preferred_contact_time?: string | null
          primary_goal?: string | null
          referral_source?: string | null
          state?: string | null
          team_size?: string | null
          terms_accepted?: boolean | null
          updated_at?: string
          years_experience?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_onboarding_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          funnel_name: string
          id: string
          is_free: boolean | null
          product_id: string | null
          total_leads: number
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          funnel_name: string
          id?: string
          is_free?: boolean | null
          product_id?: string | null
          total_leads?: number
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          funnel_name?: string
          id?: string
          is_free?: boolean | null
          product_id?: string | null
          total_leads?: number
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          funnel_id: string | null
          id: string
          is_connected: boolean | null
          lead_id: string
          product_id: string | null
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          funnel_id?: string | null
          id?: string
          is_connected?: boolean | null
          lead_id: string
          product_id?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          funnel_id?: string | null
          id?: string
          is_connected?: boolean | null
          lead_id?: string
          product_id?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_name: string
          contact_name: string
          country: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          mango_id: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          value: number | null
          workshop_name: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_name: string
          contact_name: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          mango_id?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number | null
          workshop_name?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_name?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          mango_id?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number | null
          workshop_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          funnel_id: string
          id: string
          is_active: boolean
          mango_id: string | null
          price: number
          product_name: string
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          funnel_id: string
          id?: string
          is_active?: boolean
          mango_id?: string | null
          price?: number
          product_name: string
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          funnel_id?: string
          id?: string
          is_active?: boolean
          mango_id?: string | null
          price?: number
          product_name?: string
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount: number
          closed_date: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          sales_rep: string
          updated_at: string
        }
        Insert: {
          amount: number
          closed_date?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          sales_rep: string
          updated_at?: string
        }
        Update: {
          amount?: number
          closed_date?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          sales_rep?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_sales_rep_fkey"
            columns: ["sales_rep"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          ad_spend: number | null
          amount: number | null
          created_at: string
          created_by: string
          current_participants: number | null
          description: string | null
          end_date: string
          funnel_id: string | null
          id: string
          is_free: boolean | null
          lead_id: string | null
          location: string | null
          max_participants: number | null
          product_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["workshop_status"]
          title: string
          updated_at: string
        }
        Insert: {
          ad_spend?: number | null
          amount?: number | null
          created_at?: string
          created_by: string
          current_participants?: number | null
          description?: string | null
          end_date: string
          funnel_id?: string | null
          id?: string
          is_free?: boolean | null
          lead_id?: string | null
          location?: string | null
          max_participants?: number | null
          product_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["workshop_status"]
          title: string
          updated_at?: string
        }
        Update: {
          ad_spend?: number | null
          amount?: number | null
          created_at?: string
          created_by?: string
          current_participants?: number | null
          description?: string | null
          end_date?: string
          funnel_id?: string | null
          id?: string
          is_free?: boolean | null
          lead_id?: string | null
          location?: string | null
          max_participants?: number | null
          product_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["workshop_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshops_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_closer_call_counts: {
        Args: { target_date: string }
        Returns: {
          call_count: number
          full_name: string
          id: string
        }[]
      }
      get_product_user_counts: {
        Args: never
        Returns: {
          product_id: string
          user_count: number
        }[]
      }
      get_workshop_metrics: {
        Args: never
        Returns: {
          booking_amount_calls: number
          converted_calls: number
          not_converted_calls: number
          registration_count: number
          remaining_calls: number
          rescheduled_calls: number
          sales_count: number
          total_cash_received: number
          total_offer_amount: number
          workshop_id: string
        }[]
      }
      get_workshop_name_for_lead: {
        Args: { p_lead_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sales_rep" | "viewer"
      call_status:
        | "scheduled"
        | "converted_beginner"
        | "converted_intermediate"
        | "converted_advance"
        | "booking_amount"
        | "not_converted"
        | "not_decided"
        | "so_so"
        | "reschedule"
        | "pending"
        | "refunded"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      reminder_status: "pending" | "sent" | "failed"
      reminder_type:
        | "two_days"
        | "one_day"
        | "three_hours"
        | "one_hour"
        | "thirty_minutes"
        | "ten_minutes"
        | "call_booked"
        | "we_are_live"
      workshop_status: "planned" | "confirmed" | "completed" | "cancelled"
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
    Enums: {
      app_role: ["admin", "sales_rep", "viewer"],
      call_status: [
        "scheduled",
        "converted_beginner",
        "converted_intermediate",
        "converted_advance",
        "booking_amount",
        "not_converted",
        "not_decided",
        "so_so",
        "reschedule",
        "pending",
        "refunded",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      reminder_status: ["pending", "sent", "failed"],
      reminder_type: [
        "two_days",
        "one_day",
        "three_hours",
        "one_hour",
        "thirty_minutes",
        "ten_minutes",
        "call_booked",
        "we_are_live",
      ],
      workshop_status: ["planned", "confirmed", "completed", "cancelled"],
    },
  },
} as const
