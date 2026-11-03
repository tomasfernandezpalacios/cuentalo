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
          group_id: string | null;
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
          group_id?: string | null;
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
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted' | 'rejected';
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id?: string;
          addressee_id: string;
          status?: 'pending';
          created_at?: string;
        };
        Update: { status?: 'accepted' | 'rejected' };
        Relationships: [];
      };
      groups: {
        // invite_code no está aquí: no se puede leer directamente (ver get_group_invite_code).
        Row: { id: string; name: string; owner_id: string; created_at: string };
        Insert: { id?: string; name: string; owner_id?: string; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: 'owner' | 'member';
          status: 'invited' | 'active';
          joined_at: string | null;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: 'member';
          status?: 'invited';
        };
        Update: { status?: 'active' };
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
          my_total: number;
          my_entry_count: number;
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
      get_group_invite_code: {
        Args: { p_group_id: string };
        Returns: string;
      };
      regenerate_group_invite_code: {
        Args: { p_group_id: string };
        Returns: string;
      };
      preview_group_by_code: {
        Args: { p_code: string };
        Returns: { group_id: string; name: string; member_count: number; is_member: boolean }[];
      };
      join_group_by_code: {
        Args: { p_code: string };
        Returns: string;
      };
      get_leaderboard: {
        Args: { counter_id: string; period: string };
        Returns: {
          user_id: string;
          username: string;
          display_name: string;
          total: number;
          entry_count: number;
          position: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
