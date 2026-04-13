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
      facebook_messages: {
        Row: {
          direction: string
          id: string
          message_text: string | null
          message_ts: string
          page_id: string
          raw: Json | null
          sender_psid: string
          user_id: string
        }
        Insert: {
          direction: string
          id?: string
          message_text?: string | null
          message_ts?: string
          page_id: string
          raw?: Json | null
          sender_psid: string
          user_id: string
        }
        Update: {
          direction?: string
          id?: string
          message_text?: string | null
          message_ts?: string
          page_id?: string
          raw?: Json | null
          sender_psid?: string
          user_id?: string
        }
        Relationships: []
      }
      facebook_page_connections: {
        Row: {
          connected_at: string
          id: string
          page_access_token: string
          page_id: string
          page_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          page_access_token: string
          page_id: string
          page_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          page_access_token?: string
          page_id?: string
          page_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          available_stock: number
          egg_size: string
          id: string
          last_updated: string
          total_produced: number
          total_sold: number
        }
        Insert: {
          available_stock?: number
          egg_size: string
          id?: string
          last_updated?: string
          total_produced?: number
          total_sold?: number
        }
        Update: {
          available_stock?: number
          egg_size?: string
          id?: string
          last_updated?: string
          total_produced?: number
          total_sold?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          egg_size: string
          id: string
          order_id: string
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          egg_size?: string
          id?: string
          order_id: string
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Update: {
          egg_size?: string
          id?: string
          order_id?: string
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_contact: string | null
          customer_name: string
          delivery_method: string
          id: string
          notes: string | null
          order_date: string
          payment_status: string
          status: string
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_contact?: string | null
          customer_name: string
          delivery_method?: string
          id?: string
          notes?: string | null
          order_date?: string
          payment_status?: string
          status?: string
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_contact?: string | null
          customer_name?: string
          delivery_method?: string
          id?: string
          notes?: string | null
          order_date?: string
          payment_status?: string
          status?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      pricing_set_items: {
        Row: {
          egg_size: Database["public"]["Enums"]["egg_size"]
          id: string
          price_per_tray: number
          pricing_set_id: string
        }
        Insert: {
          egg_size: Database["public"]["Enums"]["egg_size"]
          id?: string
          price_per_tray?: number
          pricing_set_id: string
        }
        Update: {
          egg_size?: Database["public"]["Enums"]["egg_size"]
          id?: string
          price_per_tray?: number
          pricing_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_set_items_pricing_set_id_fkey"
            columns: ["pricing_set_id"]
            isOneToOne: false
            referencedRelation: "pricing_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_sets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          wholesale_discount: number
          wholesale_min_trays: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          wholesale_discount?: number
          wholesale_min_trays?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          wholesale_discount?: number
          wholesale_min_trays?: number
        }
        Relationships: []
      }
      production_log_items: {
        Row: {
          egg_size: string
          id: string
          production_log_id: string
          trays_collected: number
        }
        Insert: {
          egg_size?: string
          id?: string
          production_log_id: string
          trays_collected?: number
        }
        Update: {
          egg_size?: string
          id?: string
          production_log_id?: string
          trays_collected?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_log_items_production_log_id_fkey"
            columns: ["production_log_id"]
            isOneToOne: false
            referencedRelation: "production_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          created_at: string
          damaged_eggs: number
          eggs_collected: number
          feed_consumed_kg: number
          id: string
          log_date: string
          mortality: number
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          damaged_eggs?: number
          eggs_collected?: number
          feed_consumed_kg?: number
          id?: string
          log_date?: string
          mortality?: number
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          damaged_eggs?: number
          eggs_collected?: number
          feed_consumed_kg?: number
          id?: string
          log_date?: string
          mortality?: number
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recalculate_inventory: {
        Args: { p_egg_size: string }
        Returns: undefined
      }
    }
    Enums: {
      egg_size:
        | "pewee"
        | "pullets"
        | "small"
        | "medium"
        | "large"
        | "extra_large"
        | "jumbo"
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
      egg_size: [
        "pewee",
        "pullets",
        "small",
        "medium",
        "large",
        "extra_large",
        "jumbo",
      ],
    },
  },
} as const
