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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          posted_by: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          posted_by?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          posted_by?: string | null
          title?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          recorded_by: string | null
          shift1: Database["public"]["Enums"]["attendance_status"] | null
          shift2: Database["public"]["Enums"]["attendance_status"] | null
          student_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          shift1?: Database["public"]["Enums"]["attendance_status"] | null
          shift2?: Database["public"]["Enums"]["attendance_status"] | null
          student_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          shift1?: Database["public"]["Enums"]["attendance_status"] | null
          shift2?: Database["public"]["Enums"]["attendance_status"] | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          academic_year_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          id: string
          subject_id: string
        }
        Insert: {
          class_id: string
          id?: string
          subject_id: string
        }
        Update: {
          class_id?: string
          id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          program_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          program_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_marks: {
        Row: {
          created_at: string
          exam_subject_id: string
          id: string
          marks: number | null
          recorded_by: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_subject_id: string
          id?: string
          marks?: number | null
          recorded_by?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_subject_id?: string
          id?: string
          marks?: number | null
          recorded_by?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_marks_exam_subject_id_fkey"
            columns: ["exam_subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_subjects: {
        Row: {
          class_id: string
          end_time: string | null
          exam_date: string | null
          exam_id: string
          id: string
          max_marks: number
          start_time: string | null
          subject_id: string
        }
        Insert: {
          class_id: string
          end_time?: string | null
          exam_date?: string | null
          exam_id: string
          id?: string
          max_marks?: number
          start_time?: string | null
          subject_id: string
        }
        Update: {
          class_id?: string
          end_time?: string | null
          exam_date?: string | null
          exam_id?: string
          id?: string
          max_marks?: number
          start_time?: string | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subjects_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          academic_year_id: string | null
          created_at: string
          end_date: string
          id: string
          kind: Database["public"]["Enums"]["exam_kind"]
          name: string
          published: boolean
          start_date: string
          term: Database["public"]["Enums"]["exam_term"]
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string
          end_date: string
          id?: string
          kind: Database["public"]["Enums"]["exam_kind"]
          name: string
          published?: boolean
          start_date: string
          term: Database["public"]["Enums"]["exam_term"]
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["exam_kind"]
          name?: string
          published?: boolean
          start_date?: string
          term?: Database["public"]["Enums"]["exam_term"]
        }
        Relationships: [
          {
            foreignKeyName: "exams_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          notes: string | null
          spent_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          notes?: string | null
          spent_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          spent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_items: {
        Row: {
          amount: number
          fee_type_id: string | null
          id: string
          label: string
          student_fee_id: string
        }
        Insert: {
          amount?: number
          fee_type_id?: string | null
          id?: string
          label: string
          student_fee_id: string
        }
        Update: {
          amount?: number
          fee_type_id?: string | null
          id?: string
          label?: string
          student_fee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_items_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_items_student_fee_id_fkey"
            columns: ["student_fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          amount: number
          class_id: string | null
          created_at: string
          fee_type_id: string
          id: string
          program_id: string | null
        }
        Insert: {
          amount?: number
          class_id?: string | null
          created_at?: string
          fee_type_id: string
          id?: string
          program_id?: string | null
        }
        Update: {
          amount?: number
          class_id?: string | null
          created_at?: string
          fee_type_id?: string
          id?: string
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          created_at: string
          default_amount: number
          id: string
          is_recurring: boolean
          name: string
        }
        Insert: {
          created_at?: string
          default_amount?: number
          id?: string
          is_recurring?: boolean
          name: string
        }
        Update: {
          created_at?: string
          default_amount?: number
          id?: string
          is_recurring?: boolean
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          notes: string | null
          paid_at: string
          recorded_by: string | null
          student_fee_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          recorded_by?: string | null
          student_fee_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          recorded_by?: string | null
          student_fee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_fee_id_fkey"
            columns: ["student_fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          attendance_permitted: boolean
          created_at: string
          email: string
          enabled: boolean
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          attendance_permitted?: boolean
          created_at?: string
          email: string
          enabled?: boolean
          full_name?: string
          id: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          attendance_permitted?: boolean
          created_at?: string
          email?: string
          enabled?: boolean
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      salary_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_advance: boolean
          notes: string | null
          paid_at: string
          period_month: number
          period_year: number
          staff_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_advance?: boolean
          notes?: string | null
          paid_at?: string
          period_month: number
          period_year: number
          staff_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_advance?: boolean
          notes?: string | null
          paid_at?: string
          period_month?: number
          period_year?: number
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          account_number: string | null
          address: string | null
          email: string | null
          id: number
          logo_url: string | null
          name: string
          non_school_weekdays: number[]
          phone: string | null
          student_id_padding: number
          student_id_prefix: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          email?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          non_school_weekdays?: number[]
          phone?: string | null
          student_id_padding?: number
          student_id_prefix?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          address?: string | null
          email?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          non_school_weekdays?: number[]
          phone?: string | null
          student_id_padding?: number
          student_id_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          joined_at: string | null
          monthly_salary: number
          notes: string | null
          phone: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          joined_at?: string | null
          monthly_salary?: number
          notes?: string | null
          phone?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          joined_at?: string | null
          monthly_salary?: number
          notes?: string | null
          phone?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      student_fees: {
        Row: {
          created_at: string
          discount: number
          id: string
          notes: string | null
          paid: number
          period_month: number
          period_year: number
          student_id: string
          total_fee: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          notes?: string | null
          paid?: number
          period_month: number
          period_year: number
          student_id: string
          total_fee?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          notes?: string | null
          paid?: number
          period_month?: number
          period_year?: number
          student_id?: string
          total_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_transport: {
        Row: {
          id: string
          pickup_point: string | null
          route_id: string
          student_id: string
        }
        Insert: {
          id?: string
          pickup_point?: string | null
          route_id: string
          student_id: string
        }
        Update: {
          id?: string
          pickup_point?: string | null
          route_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_transport_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year_id: string | null
          address: string | null
          batch_id: string | null
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          enabled: boolean
          exam_code: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          middle_name: string | null
          parent_name: string | null
          parent_phone: string | null
          photo_url: string | null
          program_id: string | null
          roll_number: number | null
          student_code: string
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          address?: string | null
          batch_id?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          enabled?: boolean
          exam_code?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          middle_name?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          photo_url?: string | null
          program_id?: string | null
          roll_number?: number | null
          student_code: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          address?: string | null
          batch_id?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          enabled?: boolean
          exam_code?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          middle_name?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          photo_url?: string | null
          program_id?: string | null
          roll_number?: number | null
          student_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          teacher_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          teacher_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          name: string
          notes: string | null
          vehicle_number: string | null
        }
        Insert: {
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          name: string
          notes?: string | null
          vehicle_number?: string | null
        }
        Update: {
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          name?: string
          notes?: string | null
          vehicle_number?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_sub: { Args: { _user_id: string }; Returns: boolean }
      is_enabled: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "sub_admin" | "teacher"
      attendance_status: "present" | "absent" | "exception"
      exam_kind: "mid" | "final"
      exam_term: "term1" | "term2"
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
      app_role: ["admin", "sub_admin", "teacher"],
      attendance_status: ["present", "absent", "exception"],
      exam_kind: ["mid", "final"],
      exam_term: ["term1", "term2"],
    },
  },
} as const
