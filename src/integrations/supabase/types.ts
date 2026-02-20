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
      batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_custom: boolean
          monthly_price: number
          name: string
          slug: string
          updated_at: string
          yearly_price: number
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_custom?: boolean
          monthly_price?: number
          name: string
          slug: string
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_custom?: boolean
          monthly_price?: number
          name?: string
          slug?: string
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      call_appointments: {
        Row: {
          access_given: boolean | null
          access_given_at: string | null
          additional_comments: string | null
          batch_id: string | null
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          cash_received: number | null
          classes_access: number | null
          closer_id: string | null
          closer_remarks: string | null
          conversion_date: string | null
          created_at: string
          created_by: string | null
          due_amount: number | null
          gst_fees: number | null
          id: string
          last_rebooked_at: string | null
          lead_id: string
          next_follow_up_date: string | null
          no_cost_emi: number | null
          offer_amount: number | null
          organization_id: string
          pay_after_earning: boolean | null
          payment_platform: string | null
          payment_remarks: string | null
          platform_fees: number | null
          previous_closer_id: string | null
          previous_scheduled_date: string | null
          previous_scheduled_time: string | null
          refund_reason: string | null
          rescheduled_at: string | null
          scheduled_date: string
          scheduled_time: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
          was_rescheduled: boolean | null
          zoom_link: string | null
        }
        Insert: {
          access_given?: boolean | null
          access_given_at?: string | null
          additional_comments?: string | null
          batch_id?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          cash_received?: number | null
          classes_access?: number | null
          closer_id?: string | null
          closer_remarks?: string | null
          conversion_date?: string | null
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          gst_fees?: number | null
          id?: string
          last_rebooked_at?: string | null
          lead_id: string
          next_follow_up_date?: string | null
          no_cost_emi?: number | null
          offer_amount?: number | null
          organization_id?: string
          pay_after_earning?: boolean | null
          payment_platform?: string | null
          payment_remarks?: string | null
          platform_fees?: number | null
          previous_closer_id?: string | null
          previous_scheduled_date?: string | null
          previous_scheduled_time?: string | null
          refund_reason?: string | null
          rescheduled_at?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
          was_rescheduled?: boolean | null
          zoom_link?: string | null
        }
        Update: {
          access_given?: boolean | null
          access_given_at?: string | null
          additional_comments?: string | null
          batch_id?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          cash_received?: number | null
          classes_access?: number | null
          closer_id?: string | null
          closer_remarks?: string | null
          conversion_date?: string | null
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          gst_fees?: number | null
          id?: string
          last_rebooked_at?: string | null
          lead_id?: string
          next_follow_up_date?: string | null
          no_cost_emi?: number | null
          offer_amount?: number | null
          organization_id?: string
          pay_after_earning?: boolean | null
          payment_platform?: string | null
          payment_remarks?: string | null
          platform_fees?: number | null
          previous_closer_id?: string | null
          previous_scheduled_date?: string | null
          previous_scheduled_time?: string | null
          refund_reason?: string | null
          rescheduled_at?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
          was_rescheduled?: boolean | null
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_appointments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cohort_batches"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "call_appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_appointments_previous_closer_id_fkey"
            columns: ["previous_closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_phone_reminder_types: {
        Row: {
          closer_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          label: string
          offset_type: string
          offset_value: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          closer_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          offset_type: string
          offset_value: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          closer_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          offset_type?: string
          offset_value?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_phone_reminder_types_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_phone_reminder_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_phone_reminders: {
        Row: {
          appointment_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          organization_id: string
          reminder_time: string
          reminder_type_id: string
          skip_reason: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          organization_id: string
          reminder_time: string
          reminder_type_id: string
          skip_reason?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          reminder_time?: string
          reminder_type_id?: string
          skip_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_phone_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "call_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_phone_reminders_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_phone_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_phone_reminders_reminder_type_id_fkey"
            columns: ["reminder_type_id"]
            isOneToOne: false
            referencedRelation: "call_phone_reminder_types"
            referencedColumns: ["id"]
          },
        ]
      }
      call_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          organization_id: string
          reminder_time: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"] | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          organization_id?: string
          reminder_time: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          organization_id?: string
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
          {
            foreignKeyName: "call_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_integrations: {
        Row: {
          closer_id: string
          created_at: string | null
          id: string
          integration_id: string
          is_default: boolean | null
          organization_id: string
        }
        Insert: {
          closer_id: string
          created_at?: string | null
          id?: string
          integration_id: string
          is_default?: boolean | null
          organization_id: string
        }
        Update: {
          closer_id?: string
          created_at?: string | null
          id?: string
          integration_id?: string
          is_default?: boolean | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closer_integrations_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_integrations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "organization_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_notification_configs: {
        Row: {
          aisensy_integration_id: string | null
          closer_id: string
          created_at: string
          id: string
          include_zoom_link_types: string[]
          is_active: boolean
          organization_id: string
          support_number: string | null
          templates: Json
          updated_at: string
          video_url: string | null
        }
        Insert: {
          aisensy_integration_id?: string | null
          closer_id: string
          created_at?: string
          id?: string
          include_zoom_link_types?: string[]
          is_active?: boolean
          organization_id: string
          support_number?: string | null
          templates?: Json
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          aisensy_integration_id?: string | null
          closer_id?: string
          created_at?: string
          id?: string
          include_zoom_link_types?: string[]
          is_active?: boolean
          organization_id?: string
          support_number?: string | null
          templates?: Json
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closer_notification_configs_aisensy_integration_id_fkey"
            columns: ["aisensy_integration_id"]
            isOneToOne: false
            referencedRelation: "organization_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_notification_configs_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_notification_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_batches: {
        Row: {
          cohort_type_id: string
          created_at: string
          created_by: string | null
          event_dates: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cohort_type_id: string
          created_at?: string
          created_by?: string | null
          event_dates?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cohort_type_id?: string
          created_at?: string
          created_by?: string | null
          event_dates?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_batches_cohort_type_id_fkey"
            columns: ["cohort_type_id"]
            isOneToOne: false
            referencedRelation: "cohort_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_emi_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          emi_number: number
          gst_fees: number | null
          id: string
          no_cost_emi: number | null
          organization_id: string
          payment_date: string
          payment_platform: string | null
          platform_fees: number | null
          previous_cash_received: number | null
          remarks: string | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          emi_number: number
          gst_fees?: number | null
          id?: string
          no_cost_emi?: number | null
          organization_id: string
          payment_date: string
          payment_platform?: string | null
          platform_fees?: number | null
          previous_cash_received?: number | null
          remarks?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          emi_number?: number
          gst_fees?: number | null
          id?: string
          no_cost_emi?: number | null
          organization_id?: string
          payment_date?: string
          payment_platform?: string | null
          platform_fees?: number | null
          previous_cash_received?: number | null
          remarks?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_emi_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_emi_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_emi_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "cohort_students"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_offer_amount_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_amount: number
          organization_id: string
          previous_amount: number
          reason: string | null
          student_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_amount: number
          organization_id: string
          previous_amount: number
          reason?: string | null
          student_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_amount?: number
          organization_id?: string
          previous_amount?: number
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_offer_amount_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_offer_amount_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_offer_amount_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "cohort_students"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_students: {
        Row: {
          cash_received: number | null
          classes_access: number | null
          closer_id: string | null
          cohort_batch_id: string
          conversion_date: string
          created_at: string
          created_by: string | null
          due_amount: number | null
          gst_fees: number | null
          id: string
          lead_id: string | null
          next_follow_up_date: string | null
          no_cost_emi: number | null
          notes: string | null
          offer_amount: number | null
          organization_id: string
          pay_after_earning: boolean | null
          payment_platform: string | null
          payment_remarks: string | null
          platform_fees: number | null
          refund_reason: string | null
          status: string
        }
        Insert: {
          cash_received?: number | null
          classes_access?: number | null
          closer_id?: string | null
          cohort_batch_id: string
          conversion_date?: string
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          gst_fees?: number | null
          id?: string
          lead_id?: string | null
          next_follow_up_date?: string | null
          no_cost_emi?: number | null
          notes?: string | null
          offer_amount?: number | null
          organization_id: string
          pay_after_earning?: boolean | null
          payment_platform?: string | null
          payment_remarks?: string | null
          platform_fees?: number | null
          refund_reason?: string | null
          status?: string
        }
        Update: {
          cash_received?: number | null
          classes_access?: number | null
          closer_id?: string | null
          cohort_batch_id?: string
          conversion_date?: string
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          gst_fees?: number | null
          id?: string
          lead_id?: string | null
          next_follow_up_date?: string | null
          no_cost_emi?: number | null
          notes?: string | null
          offer_amount?: number | null
          organization_id?: string
          pay_after_earning?: boolean | null
          payment_platform?: string | null
          payment_remarks?: string | null
          platform_fees?: number | null
          refund_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_students_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_students_cohort_batch_id_fkey"
            columns: ["cohort_batch_id"]
            isOneToOne: false
            referencedRelation: "cohort_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_types: {
        Row: {
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          route: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          route: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          route?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohort_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      community_templates: {
        Row: {
          created_at: string | null
          description_template: string
          id: string
          organization_id: string
          profile_picture_url: string | null
          tag_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description_template: string
          id?: string
          organization_id: string
          profile_picture_url?: string | null
          tag_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description_template?: string
          id?: string
          organization_id?: string
          profile_picture_url?: string | null
          tag_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_templates_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "workshop_tags"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "customer_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_money_flow: {
        Row: {
          cash_collected: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          organization_id: string
          total_revenue: number
          updated_at: string
        }
        Insert: {
          cash_collected?: number
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          notes?: string | null
          organization_id?: string
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          cash_collected?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_money_flow_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_letter_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          notes: string | null
          organization_id: string
          payload: Json
          retry_count: number
          retry_payload: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string
          source_table: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payload: Json
          retry_count?: number
          retry_payload?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id: string
          source_table: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payload?: Json
          retry_count?: number
          retry_payload?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string
          source_table?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dead_letter_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_links: {
        Row: {
          click_count: number
          created_at: string
          created_by: string | null
          destination_url: string | null
          id: string
          is_active: boolean
          organization_id: string
          slug: string
          updated_at: string
          whatsapp_group_id: string | null
        }
        Insert: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          destination_url?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          slug: string
          updated_at?: string
          whatsapp_group_id?: string | null
        }
        Update: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          destination_url?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          slug?: string
          updated_at?: string
          whatsapp_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dynamic_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_links_whatsapp_group_id_fkey"
            columns: ["whatsapp_group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      emi_payments: {
        Row: {
          amount: number
          appointment_id: string
          created_at: string | null
          created_by: string | null
          emi_number: number
          gst_fees: number | null
          id: string
          new_classes_access: number | null
          no_cost_emi: number | null
          organization_id: string
          payment_date: string
          payment_platform: string | null
          platform_fees: number | null
          previous_cash_received: number | null
          previous_classes_access: number | null
          remarks: string | null
        }
        Insert: {
          amount: number
          appointment_id: string
          created_at?: string | null
          created_by?: string | null
          emi_number: number
          gst_fees?: number | null
          id?: string
          new_classes_access?: number | null
          no_cost_emi?: number | null
          organization_id?: string
          payment_date: string
          payment_platform?: string | null
          platform_fees?: number | null
          previous_cash_received?: number | null
          previous_classes_access?: number | null
          remarks?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string
          created_at?: string | null
          created_by?: string | null
          emi_number?: number
          gst_fees?: number | null
          id?: string
          new_classes_access?: number | null
          no_cost_emi?: number | null
          organization_id?: string
          payment_date?: string
          payment_platform?: string | null
          platform_fees?: number | null
          previous_cash_received?: number | null
          previous_classes_access?: number | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emi_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "call_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emi_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emi_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
            foreignKeyName: "funnels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      futures_emi_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          emi_number: number
          gst_fees: number | null
          id: string
          no_cost_emi: number | null
          organization_id: string
          payment_date: string
          payment_platform: string | null
          platform_fees: number | null
          previous_cash_received: number | null
          remarks: string | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          emi_number: number
          gst_fees?: number | null
          id?: string
          no_cost_emi?: number | null
          organization_id?: string
          payment_date: string
          payment_platform?: string | null
          platform_fees?: number | null
          previous_cash_received?: number | null
          remarks?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          emi_number?: number
          gst_fees?: number | null
          id?: string
          no_cost_emi?: number | null
          organization_id?: string
          payment_date?: string
          payment_platform?: string | null
          platform_fees?: number | null
          previous_cash_received?: number | null
          remarks?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "futures_emi_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_emi_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_emi_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "futures_mentorship_students"
            referencedColumns: ["id"]
          },
        ]
      }
      futures_mentorship_batches: {
        Row: {
          created_at: string
          created_by: string | null
          event_dates: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_dates?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_dates?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "futures_mentorship_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_mentorship_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      futures_mentorship_students: {
        Row: {
          batch_id: string
          cash_received: number | null
          classes_access: number | null
          closer_id: string | null
          conversion_date: string
          created_at: string
          created_by: string | null
          due_amount: number | null
          gst_fees: number | null
          id: string
          lead_id: string | null
          next_follow_up_date: string | null
          no_cost_emi: number | null
          notes: string | null
          offer_amount: number | null
          organization_id: string
          pay_after_earning: boolean | null
          payment_platform: string | null
          payment_remarks: string | null
          platform_fees: number | null
          refund_reason: string | null
          status: string
        }
        Insert: {
          batch_id: string
          cash_received?: number | null
          classes_access?: number | null
          closer_id?: string | null
          conversion_date?: string
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          gst_fees?: number | null
          id?: string
          lead_id?: string | null
          next_follow_up_date?: string | null
          no_cost_emi?: number | null
          notes?: string | null
          offer_amount?: number | null
          organization_id?: string
          pay_after_earning?: boolean | null
          payment_platform?: string | null
          payment_remarks?: string | null
          platform_fees?: number | null
          refund_reason?: string | null
          status?: string
        }
        Update: {
          batch_id?: string
          cash_received?: number | null
          classes_access?: number | null
          closer_id?: string | null
          conversion_date?: string
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          gst_fees?: number | null
          id?: string
          lead_id?: string | null
          next_follow_up_date?: string | null
          no_cost_emi?: number | null
          notes?: string | null
          offer_amount?: number | null
          organization_id?: string
          pay_after_earning?: boolean | null
          payment_platform?: string | null
          payment_remarks?: string | null
          platform_fees?: number | null
          refund_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "futures_mentorship_students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "futures_mentorship_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_mentorship_students_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_mentorship_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_mentorship_students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_mentorship_students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      futures_offer_amount_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_amount: number
          organization_id: string
          previous_amount: number
          reason: string | null
          student_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_amount: number
          organization_id?: string
          previous_amount: number
          reason?: string | null
          student_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_amount?: number
          organization_id?: string
          previous_amount?: number
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "futures_offer_amount_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_offer_amount_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_offer_amount_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "futures_mentorship_students"
            referencedColumns: ["id"]
          },
        ]
      }
      high_future_batches: {
        Row: {
          created_at: string
          created_by: string | null
          event_dates: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_dates?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_dates?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "high_future_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      high_future_emi_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          emi_number: number
          gst_fees: number | null
          id: string
          no_cost_emi: number | null
          organization_id: string
          payment_date: string
          payment_platform: string | null
          platform_fees: number | null
          previous_cash_received: number | null
          remarks: string | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          emi_number: number
          gst_fees?: number | null
          id?: string
          no_cost_emi?: number | null
          organization_id?: string
          payment_date: string
          payment_platform?: string | null
          platform_fees?: number | null
          previous_cash_received?: number | null
          remarks?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          emi_number?: number
          gst_fees?: number | null
          id?: string
          no_cost_emi?: number | null
          organization_id?: string
          payment_date?: string
          payment_platform?: string | null
          platform_fees?: number | null
          previous_cash_received?: number | null
          remarks?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "high_future_emi_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "high_future_emi_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "high_future_students"
            referencedColumns: ["id"]
          },
        ]
      }
      high_future_offer_amount_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_amount: number
          organization_id: string
          previous_amount: number
          reason: string | null
          student_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_amount: number
          organization_id?: string
          previous_amount: number
          reason?: string | null
          student_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_amount?: number
          organization_id?: string
          previous_amount?: number
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "high_future_offer_amount_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "high_future_offer_amount_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "high_future_students"
            referencedColumns: ["id"]
          },
        ]
      }
      high_future_students: {
        Row: {
          batch_id: string
          cash_received: number | null
          classes_access: number | null
          closer_id: string | null
          conversion_date: string
          created_at: string
          created_by: string | null
          due_amount: number | null
          gst_fees: number | null
          id: string
          lead_id: string | null
          next_follow_up_date: string | null
          no_cost_emi: number | null
          notes: string | null
          offer_amount: number | null
          organization_id: string
          pay_after_earning: boolean | null
          payment_platform: string | null
          payment_remarks: string | null
          platform_fees: number | null
          refund_reason: string | null
          status: string
        }
        Insert: {
          batch_id: string
          cash_received?: number | null
          classes_access?: number | null
          closer_id?: string | null
          conversion_date?: string
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          gst_fees?: number | null
          id?: string
          lead_id?: string | null
          next_follow_up_date?: string | null
          no_cost_emi?: number | null
          notes?: string | null
          offer_amount?: number | null
          organization_id?: string
          pay_after_earning?: boolean | null
          payment_platform?: string | null
          payment_remarks?: string | null
          platform_fees?: number | null
          refund_reason?: string | null
          status?: string
        }
        Update: {
          batch_id?: string
          cash_received?: number | null
          classes_access?: number | null
          closer_id?: string | null
          conversion_date?: string
          created_at?: string
          created_by?: string | null
          due_amount?: number | null
          gst_fees?: number | null
          id?: string
          lead_id?: string | null
          next_follow_up_date?: string | null
          no_cost_emi?: number | null
          notes?: string | null
          offer_amount?: number | null
          organization_id?: string
          pay_after_earning?: boolean | null
          payment_platform?: string | null
          payment_remarks?: string | null
          platform_fees?: number | null
          refund_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "high_future_students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "high_future_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "high_future_students_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "high_future_students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "high_future_students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          converted_from_workshop_id: string | null
          created_at: string
          created_by: string | null
          funnel_id: string | null
          id: string
          is_connected: boolean | null
          is_refunded: boolean | null
          lead_id: string
          organization_id: string
          product_id: string | null
          refund_reason: string | null
          refunded_at: string | null
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          converted_from_workshop_id?: string | null
          created_at?: string
          created_by?: string | null
          funnel_id?: string | null
          id?: string
          is_connected?: boolean | null
          is_refunded?: boolean | null
          lead_id: string
          organization_id?: string
          product_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          converted_from_workshop_id?: string | null
          created_at?: string
          created_by?: string | null
          funnel_id?: string | null
          id?: string
          is_connected?: boolean | null
          is_refunded?: boolean | null
          lead_id?: string
          organization_id?: string
          product_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_converted_from_workshop_id_fkey"
            columns: ["converted_from_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "lead_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          phone: string | null
          previous_assigned_to: string | null
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
          organization_id?: string
          phone?: string | null
          previous_assigned_to?: string | null
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
          organization_id?: string
          phone?: string | null
          previous_assigned_to?: string | null
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
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_previous_assigned_to_fkey"
            columns: ["previous_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_premium: boolean | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_premium?: boolean | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_premium?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      notification_campaign_groups: {
        Row: {
          campaign_id: string
          created_at: string
          delivered_count: number
          error_message: string | null
          group_id: string
          group_jid: string
          group_name: string
          id: string
          member_count: number
          message_id: string | null
          reaction_count: number
          read_count: number
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delivered_count?: number
          error_message?: string | null
          group_id: string
          group_jid: string
          group_name: string
          id?: string
          member_count?: number
          message_id?: string | null
          reaction_count?: number
          read_count?: number
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delivered_count?: number
          error_message?: string | null
          group_id?: string
          group_jid?: string
          group_name?: string
          id?: string
          member_count?: number
          message_id?: string | null
          reaction_count?: number
          read_count?: number
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaign_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "notification_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_campaign_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaign_reactions: {
        Row: {
          campaign_group_id: string
          created_at: string
          emoji: string
          id: string
          reacted_at: string
          reactor_phone: string
        }
        Insert: {
          campaign_group_id: string
          created_at?: string
          emoji: string
          id?: string
          reacted_at?: string
          reactor_phone: string
        }
        Update: {
          campaign_group_id?: string
          created_at?: string
          emoji?: string
          id?: string
          reacted_at?: string
          reactor_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaign_reactions_campaign_group_id_fkey"
            columns: ["campaign_group_id"]
            isOneToOne: false
            referencedRelation: "notification_campaign_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaign_reads: {
        Row: {
          campaign_group_id: string
          created_at: string
          id: string
          read_at: string
          reader_phone: string
          receipt_type: string
        }
        Insert: {
          campaign_group_id: string
          created_at?: string
          id?: string
          read_at?: string
          reader_phone: string
          receipt_type?: string
        }
        Update: {
          campaign_group_id?: string
          created_at?: string
          id?: string
          read_at?: string
          reader_phone?: string
          receipt_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaign_reads_campaign_group_id_fkey"
            columns: ["campaign_group_id"]
            isOneToOne: false
            referencedRelation: "notification_campaign_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          delay_seconds: number
          failed_count: number
          id: string
          media_type: string | null
          media_url: string | null
          message_content: string
          name: string
          organization_id: string
          scheduled_for: string | null
          sent_count: number
          session_id: string
          started_at: string | null
          status: string
          total_audience: number
          total_groups: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          failed_count?: number
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content: string
          name: string
          organization_id: string
          scheduled_for?: string | null
          sent_count?: number
          session_id: string
          started_at?: string | null
          status?: string
          total_audience?: number
          total_groups?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          failed_count?: number
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          name?: string
          organization_id?: string
          scheduled_for?: string | null
          sent_count?: number
          session_id?: string
          started_at?: string | null
          status?: string
          total_audience?: number
          total_groups?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_amount_history: {
        Row: {
          appointment_id: string
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_amount: number
          organization_id: string
          previous_amount: number
          reason: string | null
        }
        Insert: {
          appointment_id: string
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_amount: number
          organization_id?: string
          previous_amount: number
          reason?: string | null
        }
        Update: {
          appointment_id?: string
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_amount?: number
          organization_id?: string
          previous_amount?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_amount_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "call_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_amount_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_amount_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_feature_overrides: {
        Row: {
          created_at: string
          disabled_integrations: string[] | null
          disabled_permissions: string[] | null
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled_integrations?: string[] | null
          disabled_permissions?: string[] | null
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled_integrations?: string[] | null
          disabled_permissions?: string[] | null
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_feature_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_features: {
        Row: {
          created_at: string | null
          feature_key: string
          id: string
          is_enabled: boolean | null
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean | null
          organization_id: string
        }
        Update: {
          created_at?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_integrations: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          integration_name: string | null
          integration_type: string
          is_active: boolean | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          integration_name?: string | null
          integration_type: string
          is_active?: boolean | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          integration_name?: string | null
          integration_type?: string
          is_active?: boolean | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          is_org_admin: boolean | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_org_admin?: boolean | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_org_admin?: boolean | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          config: Json | null
          created_at: string | null
          enabled_at: string | null
          enabled_by: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          organization_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          organization_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          admin_notes: string | null
          billing_cycle: string
          cancelled_reason: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          current_price: number | null
          custom_limits: Json | null
          custom_price: number | null
          downgrade_date: string | null
          id: string
          next_payment_due: string | null
          organization_id: string
          plan_id: string
          setup_fee: number | null
          setup_fee_paid: boolean | null
          status: string
          subscription_started_at: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          upgrade_from_plan_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          billing_cycle?: string
          cancelled_reason?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          current_price?: number | null
          custom_limits?: Json | null
          custom_price?: number | null
          downgrade_date?: string | null
          id?: string
          next_payment_due?: string | null
          organization_id: string
          plan_id: string
          setup_fee?: number | null
          setup_fee_paid?: boolean | null
          status?: string
          subscription_started_at?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          upgrade_from_plan_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          billing_cycle?: string
          cancelled_reason?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          current_price?: number | null
          custom_limits?: Json | null
          custom_price?: number | null
          downgrade_date?: string | null
          id?: string
          next_payment_due?: string | null
          organization_id?: string
          plan_id?: string
          setup_fee?: number | null
          setup_fee_paid?: boolean | null
          status?: string
          subscription_started_at?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          upgrade_from_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_upgrade_from_plan_id_fkey"
            columns: ["upgrade_from_plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_usage: {
        Row: {
          id: string
          organization_id: string
          period_end: string
          period_start: string
          updated_at: string
          usage_key: string
          usage_value: number
        }
        Insert: {
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          updated_at?: string
          usage_key: string
          usage_value?: number
        }
        Update: {
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          updated_at?: string
          usage_key?: string
          usage_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_webhooks: {
        Row: {
          created_at: string | null
          direction: string
          field_mappings: Json | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          payload_template: Json | null
          secret: string | null
          trigger_event: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          direction: string
          field_mappings?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          payload_template?: Json | null
          secret?: string | null
          trigger_event?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          field_mappings?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          payload_template?: Json | null
          secret?: string | null
          trigger_event?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          community_admin_numbers: string[] | null
          community_session_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          slug: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          community_admin_numbers?: string[] | null
          community_session_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          slug: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          community_admin_numbers?: string[] | null
          community_session_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_community_session_id_fkey"
            columns: ["community_session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          description: string | null
          feature_key: string
          feature_value: string
          id: string
          plan_id: string
        }
        Insert: {
          description?: string | null
          feature_key: string
          feature_value?: string
          id?: string
          plan_id: string
        }
        Update: {
          description?: string | null
          feature_key?: string
          feature_value?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          description: string | null
          id: string
          limit_key: string
          limit_value: number
          plan_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          limit_key: string
          limit_value?: number
          plan_id: string
        }
        Update: {
          description?: string | null
          id?: string
          limit_key?: string
          limit_value?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      scheduled_sms_messages: {
        Row: {
          created_at: string
          error_message: string | null
          fast2sms_request_id: string | null
          id: string
          lead_id: string
          message_type: string | null
          organization_id: string
          retry_count: number | null
          scheduled_for: string
          sent_at: string | null
          status: string
          template_id: string
          variable_values: Json | null
          workshop_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          fast2sms_request_id?: string | null
          id?: string
          lead_id: string
          message_type?: string | null
          organization_id: string
          retry_count?: number | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          template_id: string
          variable_values?: Json | null
          workshop_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          fast2sms_request_id?: string | null
          id?: string
          lead_id?: string
          message_type?: string | null
          organization_id?: string
          retry_count?: number | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template_id?: string
          variable_values?: Json | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_sms_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sms_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sms_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sms_messages_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_whatsapp_messages: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          group_id: string
          id: string
          media_type: string | null
          media_url: string | null
          message_content: string
          message_type: string
          organization_id: string
          retry_count: number | null
          scheduled_for: string
          sent_at: string | null
          status: string
          workshop_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          group_id: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content: string
          message_type: string
          organization_id: string
          retry_count?: number | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          workshop_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          group_id?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          message_type?: string
          organization_id?: string
          retry_count?: number | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_whatsapp_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_whatsapp_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_whatsapp_messages_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_sequence_steps: {
        Row: {
          created_at: string
          id: string
          send_time: string
          sequence_id: string
          step_order: number
          template_id: string
          time_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          send_time: string
          sequence_id: string
          step_order: number
          template_id: string
          time_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          send_time?: string
          sequence_id?: string
          step_order?: number
          template_id?: string
          time_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sms_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          content_preview: string
          created_at: string
          dlt_template_id: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          content_preview: string
          created_at?: string
          dlt_template_id: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          content_preview?: string
          created_at?: string
          dlt_template_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_audit_log: {
        Row: {
          action: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_at: string
          performed_by: string | null
          subscription_id: string | null
        }
        Insert: {
          action: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          subscription_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_audit_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          notification_type: string
          organization_id: string
          read_at: string | null
          read_by: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type: string
          organization_id: string
          read_at?: string | null
          read_by?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type?: string
          organization_id?: string
          read_at?: string | null
          read_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_notifications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          payment_type: string
          recorded_by: string | null
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_type: string
          recorded_by?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_type?: string
          recorded_by?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sequence_steps: {
        Row: {
          created_at: string
          id: string
          send_time: string
          sequence_id: string
          step_order: number
          template_id: string
          time_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          send_time: string
          sequence_id: string
          step_order: number
          template_id: string
          time_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          send_time?: string
          sequence_id?: string
          step_order?: number
          template_id?: string
          time_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "template_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          organization_id: string | null
          permission_key: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string | null
          permission_key: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string | null
          permission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      webhook_ingest_events: {
        Row: {
          amount: number | null
          created_at: string
          created_product_id: string | null
          created_workshop_id: string | null
          email: string | null
          error_message: string | null
          id: string
          is_duplicate: boolean | null
          lead_id: string | null
          mango_id: string | null
          organization_id: string
          processing_time_ms: number | null
          result: string
          source: string
          workshop_name: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_product_id?: string | null
          created_workshop_id?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          is_duplicate?: boolean | null
          lead_id?: string | null
          mango_id?: string | null
          organization_id?: string
          processing_time_ms?: number | null
          result?: string
          source?: string
          workshop_name?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_product_id?: string | null
          created_workshop_id?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          is_duplicate?: boolean | null
          lead_id?: string | null
          mango_id?: string | null
          organization_id?: string
          processing_time_ms?: number | null
          result?: string
          source?: string
          workshop_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_ingest_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_admins: {
        Row: {
          group_id: string
          id: string
          is_super_admin: boolean
          organization_id: string
          phone: string
          synced_at: string
        }
        Insert: {
          group_id: string
          id?: string
          is_super_admin?: boolean
          organization_id: string
          phone: string
          synced_at?: string
        }
        Update: {
          group_id?: string
          id?: string
          is_super_admin?: boolean
          organization_id?: string
          phone?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_admins_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_admins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          group_jid: string
          group_name: string
          id: string
          invite_link: string | null
          is_active: boolean | null
          is_admin: boolean | null
          is_community: boolean
          is_community_announce: boolean
          organization_id: string
          participant_count: number | null
          session_id: string
          synced_at: string | null
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          created_at?: string
          group_jid: string
          group_name: string
          id?: string
          invite_link?: string | null
          is_active?: boolean | null
          is_admin?: boolean | null
          is_community?: boolean
          is_community_announce?: boolean
          organization_id: string
          participant_count?: number | null
          session_id: string
          synced_at?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          created_at?: string
          group_jid?: string
          group_name?: string
          id?: string
          invite_link?: string | null
          is_active?: boolean | null
          is_admin?: boolean | null
          is_community?: boolean
          is_community_announce?: boolean
          organization_id?: string
          participant_count?: number | null
          session_id?: string
          synced_at?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_groups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_groups_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_templates: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          media_url: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          media_url?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          media_url?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          connected_at: string | null
          created_at: string
          display_name: string | null
          id: string
          last_active_at: string | null
          organization_id: string
          phone_number: string | null
          qr_code: string | null
          qr_expires_at: string | null
          session_data: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_active_at?: string | null
          organization_id: string
          phone_number?: string | null
          qr_code?: string | null
          qr_expires_at?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_active_at?: string | null
          organization_id?: string
          phone_number?: string | null
          qr_code?: string | null
          qr_expires_at?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_automation_config: {
        Row: {
          auto_schedule_messages: boolean | null
          created_at: string
          default_workshop_time: string | null
          id: string
          message_schedule: Json | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          auto_schedule_messages?: boolean | null
          created_at?: string
          default_workshop_time?: string | null
          id?: string
          message_schedule?: Json | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          auto_schedule_messages?: boolean | null
          created_at?: string
          default_workshop_time?: string | null
          id?: string
          message_schedule?: Json | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_automation_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_group_members: {
        Row: {
          created_at: string
          full_phone: string
          group_id: string | null
          group_jid: string
          id: string
          is_admin: boolean | null
          joined_at: string
          left_at: string | null
          organization_id: string
          participant_jid: string | null
          phone_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_phone: string
          group_id?: string | null
          group_jid: string
          id?: string
          is_admin?: boolean | null
          joined_at?: string
          left_at?: string | null
          organization_id: string
          participant_jid?: string | null
          phone_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_phone?: string
          group_id?: string | null
          group_jid?: string
          id?: string
          is_admin?: boolean | null
          joined_at?: string
          left_at?: string | null
          organization_id?: string
          participant_jid?: string | null
          phone_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_group_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_sequence_variables: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          updated_at: string | null
          variable_key: string
          variable_value: string
          workshop_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          updated_at?: string | null
          variable_key: string
          variable_value: string
          workshop_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          updated_at?: string | null
          variable_key?: string
          variable_value?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_sequence_variables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_sequence_variables_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          sms_sequence_id: string | null
          template_sequence_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id: string
          sms_sequence_id?: string | null
          template_sequence_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          sms_sequence_id?: string | null
          template_sequence_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_tags_sms_sequence_id_fkey"
            columns: ["sms_sequence_id"]
            isOneToOne: false
            referencedRelation: "sms_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_tags_template_sequence_id_fkey"
            columns: ["template_sequence_id"]
            isOneToOne: false
            referencedRelation: "template_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_whatsapp_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          workshop_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          workshop_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_whatsapp_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_whatsapp_groups_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          ad_spend: number | null
          amount: number | null
          automation_status: Json | null
          community_group_id: string | null
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
          mango_id: string | null
          max_participants: number | null
          organization_id: string
          product_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["workshop_status"]
          tag_id: string | null
          title: string
          updated_at: string
          whatsapp_group_id: string | null
          whatsapp_session_id: string | null
        }
        Insert: {
          ad_spend?: number | null
          amount?: number | null
          automation_status?: Json | null
          community_group_id?: string | null
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
          mango_id?: string | null
          max_participants?: number | null
          organization_id?: string
          product_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["workshop_status"]
          tag_id?: string | null
          title: string
          updated_at?: string
          whatsapp_group_id?: string | null
          whatsapp_session_id?: string | null
        }
        Update: {
          ad_spend?: number | null
          amount?: number | null
          automation_status?: Json | null
          community_group_id?: string | null
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
          mango_id?: string | null
          max_participants?: number | null
          organization_id?: string
          product_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["workshop_status"]
          tag_id?: string | null
          title?: string
          updated_at?: string
          whatsapp_group_id?: string | null
          whatsapp_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workshops_community_group_id_fkey"
            columns: ["community_group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "workshops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "workshop_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_whatsapp_group_id_fkey"
            columns: ["whatsapp_group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_whatsapp_session_id_fkey"
            columns: ["whatsapp_session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_paginated_leads: {
        Args: {
          p_country?: string
          p_date_from?: string
          p_date_to?: string
          p_organization_id: string
          p_product_ids?: string[]
          p_search?: string
          p_status?: string
          p_workshop_ids?: string[]
        }
        Returns: number
      }
      get_closer_call_counts: {
        Args: { p_organization_id?: string; target_date: string }
        Returns: {
          call_count: number
          full_name: string
          id: string
        }[]
      }
      get_closer_call_metrics: {
        Args: { p_organization_id?: string; target_date: string }
        Returns: {
          cash_collected: number
          converted_count: number
          full_name: string
          id: string
          not_converted_count: number
          offered_amount: number
          pending_count: number
          rescheduled_count: number
          total_calls: number
        }[]
      }
      get_paginated_leads: {
        Args: {
          p_country?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_organization_id: string
          p_product_ids?: string[]
          p_search?: string
          p_status?: string
          p_workshop_ids?: string[]
        }
        Returns: {
          assigned_to: string
          assigned_to_name: string
          assignment_id: string
          company_name: string
          contact_name: string
          converted_from_workshop_id: string
          converted_from_workshop_title: string
          country: string
          email: string
          funnel_id: string
          funnel_name: string
          is_connected: boolean
          is_refunded: boolean
          lead_created_at: string
          lead_id: string
          lead_status: string
          lead_updated_at: string
          notes: string
          phone: string
          previous_assigned_to: string
          previous_assigned_to_name: string
          product_id: string
          product_name: string
          product_price: number
          refund_reason: string
          refunded_at: string
          source: string
          workshop_id: string
          workshop_title: string
        }[]
      }
      get_product_user_counts: {
        Args: never
        Returns: {
          product_id: string
          user_count: number
        }[]
      }
      get_user_organization_ids: { Args: never; Returns: string[] }
      get_user_organizations: { Args: { _user_id: string }; Returns: string[] }
      get_workshop_calls_by_category: {
        Args: {
          p_category: string
          p_organization_id?: string
          p_workshop_title: string
        }
        Returns: {
          cash_received: number
          closer_name: string
          contact_name: string
          email: string
          id: string
          lead_id: string
          offer_amount: number
          original_workshop_title: string
          payment_workshop_title: string
          phone: string
          scheduled_date: string
          scheduled_time: string
          status: string
          was_rescheduled: boolean
        }[]
      }
      get_workshop_metrics: {
        Args: { p_organization_id?: string }
        Returns: {
          booking_amount_calls: number
          converted_calls: number
          cross_workshop_count: number
          fresh_booking_amount: number
          fresh_cash_received: number
          fresh_converted: number
          fresh_not_converted: number
          fresh_offer_amount: number
          fresh_remaining: number
          fresh_rescheduled_done: number
          fresh_rescheduled_remaining: number
          fresh_sales_count: number
          not_converted_calls: number
          refunded_calls: number
          registration_count: number
          rejoin_booking_amount: number
          rejoin_cash_received: number
          rejoin_converted: number
          rejoin_not_converted: number
          rejoin_offer_amount: number
          rejoin_remaining: number
          rejoin_rescheduled_done: number
          rejoin_rescheduled_remaining: number
          rejoin_sales_count: number
          remaining_calls: number
          rescheduled_done: number
          rescheduled_remaining: number
          sales_count: number
          total_calls_booked: number
          total_cash_received: number
          total_offer_amount: number
          workshop_id: string
        }[]
      }
      get_workshop_name_for_lead: {
        Args: { p_lead_id: string }
        Returns: string
      }
      get_workshop_sales_leads: {
        Args: { p_organization_id?: string; p_workshop_title: string }
        Returns: {
          assignment_id: string
          call_appointment_id: string
          closer_name: string
          contact_name: string
          email: string
          has_call_appointment: boolean
          id: string
          is_assignment_refunded: boolean
          lead_id: string
          phone: string
          scheduled_date: string
          scheduled_time: string
          status: string
        }[]
      }
      has_org_feature: {
        Args: { _feature: string; _org_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      increment_delivered_count: {
        Args: { p_group_id: string }
        Returns: number
      }
      increment_link_click: {
        Args: { link_slug: string }
        Returns: {
          destination_url: string
        }[]
      }
      increment_read_count: { Args: { p_group_id: string }; Returns: number }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      search_leads: {
        Args: { p_organization_id?: string; search_query: string }
        Returns: {
          assigned_to: string
          assigned_to_name: string
          assignment_id: string
          company_name: string
          contact_name: string
          country: string
          created_at: string
          email: string
          funnel_id: string
          funnel_name: string
          id: string
          is_connected: boolean
          is_refunded: boolean
          notes: string
          phone: string
          product_id: string
          product_name: string
          product_price: number
          refund_reason: string
          refunded_at: string
          source: string
          status: string
          updated_at: string
          workshop_id: string
          workshop_name: string
          workshop_title: string
        }[]
      }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sales_rep" | "viewer" | "manager" | "super_admin"
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
        | "converted"
        | "discontinued"
        | "no_show"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      reminder_status: "pending" | "sent" | "failed" | "skipped"
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
      app_role: ["admin", "sales_rep", "viewer", "manager", "super_admin"],
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
        "converted",
        "discontinued",
        "no_show",
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
      reminder_status: ["pending", "sent", "failed", "skipped"],
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
