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
          is_common: boolean;
          hidden_from_friends: boolean;
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
          is_common?: boolean;
          hidden_from_friends?: boolean;
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
          hidden_from_friends?: boolean;
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
          personal_only: boolean;
          group_only: boolean;
          batch_id: string | null;
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
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
          emoji: string | null;
          photo_path: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id?: string;
          created_at?: string;
          emoji?: string | null;
        };
        Update: { name?: string; emoji?: string | null; photo_path?: string | null };
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
      folders: {
        Row: { id: string; owner_id: string; name: string; created_at: string };
        Insert: { id?: string; owner_id?: string; name: string; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      folder_counters: {
        Row: { folder_id: string; counter_id: string };
        Insert: { folder_id: string; counter_id: string };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind:
            | 'friend_accepted'
            | 'request_approved'
            | 'request_rejected'
            | 'counter_deleted'
            | 'group_deleted';
          actor_id: string | null;
          counter_name: string | null;
          group_name: string | null;
          amount: number | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      counter_requests: {
        Row: {
          id: string;
          counter_id: string;
          requester_id: string;
          amount: number;
          status: 'pending' | 'approved' | 'rejected';
          created_at: string;
          decided_at: string | null;
        };
        Insert: { counter_id: string; amount: number };
        Update: never;
        Relationships: [];
      };
      hidden_counters: {
        Row: { user_id: string; counter_id: string };
        Insert: { counter_id: string; user_id?: string };
        Update: never;
        Relationships: [];
      };
      user_activity_days: {
        Row: { user_id: string; day: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      counter_links: {
        Row: { user_id: string; counter_id: string; link_id: string; is_primary: boolean };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      counter_aliases: {
        Row: { counter_id: string; user_id: string; name: string | null; emoji: string | null };
        Insert: {
          counter_id: string;
          user_id?: string;
          name?: string | null;
          emoji?: string | null;
        };
        Update: { name?: string | null; emoji?: string | null };
        Relationships: [];
      };
      counter_participants: {
        Row: { counter_id: string; user_id: string };
        Insert: never;
        Update: never;
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
          my_group_total: number;
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
      set_counter_participants: {
        Args: { p_counter_id: string; p_user_ids: string[] };
        Returns: undefined;
      };
      add_to_common_counter: {
        Args: {
          p_counter_id: string;
          p_amount: number;
          p_logged_at?: string;
          p_note?: string | null;
        };
        Returns: number;
      };
      remove_one_from_common_counter: {
        Args: { p_counter_id: string };
        Returns: number;
      };
      save_folder: {
        Args: { p_folder_id: string | null; p_name: string; p_counter_ids: string[] };
        Returns: string;
      };
      log_to_counter: {
        Args: {
          p_counter_id: string;
          p_amount: number;
          p_logged_at?: string;
          p_note?: string | null;
        };
        Returns: number;
      };
      merge_counters: {
        Args: { p_counter_ids: string[]; p_name: string | null; p_emoji: string | null };
        Returns: string;
      };
      get_friends_streaks: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          username: string;
          display_name: string;
          current_streak: number;
          best_streak: number;
        }[];
      };
      decide_counter_request: {
        Args: { p_request_id: string; p_approve: boolean };
        Returns: undefined;
      };
      delete_group_counter: {
        Args: { p_counter_id: string };
        Returns: undefined;
      };
      get_user_counters: {
        Args: { p_user_id: string };
        Returns: {
          counter_id: string;
          name: string;
          emoji: string | null;
          unit: string | null;
          group_name: string | null;
          kind: 'public' | 'common';
          their_total: number;
          my_total: number | null;
        }[];
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: undefined;
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
