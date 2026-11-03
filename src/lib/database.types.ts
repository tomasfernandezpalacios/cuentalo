// Tipos de la base de datos, escritos a mano a partir de supabase/migrations.
// Si se cambia una migración, hay que actualizar este archivo.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: never;
        Update: {
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      counters: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          unit: string | null;
          emoji: string | null;
          streak_enabled: boolean;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          unit?: string | null;
          emoji?: string | null;
          streak_enabled?: boolean;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          unit?: string | null;
          emoji?: string | null;
          streak_enabled?: boolean;
          archived?: boolean;
        };
        Relationships: [];
      };
      entries: {
        Row: {
          id: string;
          counter_id: string;
          user_id: string;
          amount: number;
          logged_at: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          counter_id: string;
          user_id?: string;
          amount: number;
          logged_at?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          amount?: number;
          logged_at?: string;
          note?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      counter_totals: {
        Row: {
          counter_id: string;
          total: number;
          entry_count: number;
          last_logged_at: string;
        };
        Relationships: [];
      };
      entry_daily_totals: {
        Row: {
          counter_id: string;
          user_id: string;
          day: string;
          total: number;
          entry_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
      can_log_to_counter: {
        Args: { p_counter_id: string };
        Returns: boolean;
      };
      remove_one_from_counter: {
        Args: { p_counter_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
