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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      blend_invites: {
        Row: {
          created_at: string
          id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      call_history: {
        Row: {
          call_direction: string
          call_type: string
          caller_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          receiver_id: string | null
          room_name: string | null
          started_at: string
          status: string
        }
        Insert: {
          call_direction?: string
          call_type?: string
          caller_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string | null
          room_name?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          call_direction?: string
          call_type?: string
          caller_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string | null
          room_name?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      code_surprises: {
        Row: {
          created_at: string
          creator_id: string
          css_content: string
          html_content: string
          id: string
          is_active: boolean
          js_content: string
          max_views: number
          title: string
          views_used: number
        }
        Insert: {
          created_at?: string
          creator_id: string
          css_content?: string
          html_content?: string
          id?: string
          is_active?: boolean
          js_content?: string
          max_views?: number
          title?: string
          views_used?: number
        }
        Update: {
          created_at?: string
          creator_id?: string
          css_content?: string
          html_content?: string
          id?: string
          is_active?: boolean
          js_content?: string
          max_views?: number
          title?: string
          views_used?: number
        }
        Relationships: []
      }
      countdowns: {
        Row: {
          created_at: string
          creator_id: string
          emoji: string | null
          id: string
          target_date: string
          title: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          emoji?: string | null
          id?: string
          target_date: string
          title: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          emoji?: string | null
          id?: string
          target_date?: string
          title?: string
        }
        Relationships: []
      }
      daily_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          question_date: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          question_date?: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          question_date?: string
          user_id?: string
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          created_at: string
          file_type: string
          file_url: string
          id: string
          is_shared: boolean
          owner_id: string
        }
        Insert: {
          created_at?: string
          file_type?: string
          file_url: string
          id?: string
          is_shared?: boolean
          owner_id: string
        }
        Update: {
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          is_shared?: boolean
          owner_id?: string
        }
        Relationships: []
      }
      invite_links: {
        Row: {
          code: string
          created_at: string
          creator_id: string
          expires_at: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          creator_id: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          creator_id?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          id: string
          latitude: number
          longitude: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          latitude: number
          longitude: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          latitude?: number
          longitude?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          caption: string | null
          created_at: string
          creator_id: string
          id: string
          image_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          creator_id: string
          id?: string
          image_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          image_url?: string | null
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          deleted_by_receiver: boolean
          deleted_by_sender: boolean
          disappear_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_read: boolean
          message_type: string
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          deleted_by_receiver?: boolean
          deleted_by_sender?: boolean
          disappear_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean
          message_type?: string
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          deleted_by_receiver?: boolean
          deleted_by_sender?: boolean
          disappear_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean
          message_type?: string
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_logs: {
        Row: {
          confidence: number
          created_at: string
          detected_at: string
          id: string
          mood: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          detected_at?: string
          id?: string
          mood: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          detected_at?: string
          id?: string
          mood?: string
          user_id?: string
        }
        Relationships: []
      }
      playlist_songs: {
        Row: {
          added_by: string
          artist: string
          created_at: string
          id: string
          platform: string
          song_url: string
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          added_by: string
          artist?: string
          created_at?: string
          id?: string
          platform?: string
          song_url: string
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          added_by?: string
          artist?: string
          created_at?: string
          id?: string
          platform?: string
          song_url?: string
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          gallery_shared: boolean
          gender: string | null
          id: string
          location_mode: string
          mood_emoji: string | null
          mood_text: string | null
          mood_updated_at: string | null
          partner_id: string | null
          pet_name: string | null
          phone_number: string | null
          public_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          gallery_shared?: boolean
          gender?: string | null
          id?: string
          location_mode?: string
          mood_emoji?: string | null
          mood_text?: string | null
          mood_updated_at?: string | null
          partner_id?: string | null
          pet_name?: string | null
          phone_number?: string | null
          public_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          gallery_shared?: boolean
          gender?: string | null
          id?: string
          location_mode?: string
          mood_emoji?: string | null
          mood_text?: string | null
          mood_updated_at?: string | null
          partner_id?: string | null
          pet_name?: string | null
          phone_number?: string | null
          public_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shayaris: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      taps: {
        Row: {
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_disappeared_messages: { Args: never; Returns: undefined }
      get_partner_id: { Args: { _user_id: string }; Returns: string }
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
