// Tipos de la base de datos, escritos a mano a partir de supabase/migrations.
// Si se cambia una migración, hay que actualizar este archivo.

/** Lo que devuelve get_my_home(): todo lo de la pantalla principal en una petición. */
export type HomeBundle = {
  counters: Database['public']['Tables']['counters']['Row'][];
  totals: Database['public']['Views']['counter_totals']['Row'][];
  groups: {
    id: string;
    name: string;
    owner_id: string;
    emoji: string | null;
    photo_path: string | null;
  }[];
  participants: { counter_id: string; user_id: string }[];
  aliases: { counter_id: string; name: string | null; emoji: string | null }[];
  links: { counter_id: string; link_id: string; is_primary: boolean }[];
  hidden: string[];
  removed: string[];
  streaks: Database['public']['Views']['my_counter_streaks']['Row'][];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          created_at: string;
          hide_streak: boolean;
          hide_counter_totals: boolean;
          group_invites: 'friends' | 'nobody';
          emoji: string | null;
          photo_path: string | null;
          tutorial_done: boolean;
          time_zone: string;
        };
        Insert: never;
        Update: {
          username?: string;
          display_name?: string;
          hide_streak?: boolean;
          hide_counter_totals?: boolean;
          group_invites?: 'friends' | 'nobody';
          emoji?: string | null;
          photo_path?: string | null;
          tutorial_done?: boolean;
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
          created_at?: string;
        };
        Update: {
          name?: string;
          unit?: string | null;
          emoji?: string | null;
          streak_enabled?: boolean;
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
            | 'friend_you_accepted'
            | 'request_approved'
            | 'request_rejected'
            | 'counter_deleted'
            | 'group_deleted'
            | 'group_admin'
            | 'member_left'
            | 'new_leader'
            | 'you_are_leader'
            | 'kicked'
            | 'group_activity';
          actor_id: string | null;
          /** Nombre de quien hizo la acción (sigue ahí aunque elimine su cuenta). */
          actor_name: string | null;
          counter_name: string | null;
          group_name: string | null;
          amount: number | null;
          /** group_activity: el contador de grupo en el que ha sumado o restado. */
          counter_id: string | null;
          /** Hasta entonces no se ve (group_activity: 20 s después del último cambio). */
          visible_from: string;
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
      profile_private: {
        Row: {
          user_id: string;
          birth_date: string | null;
          stats_blocks: string[] | null;
          counter_order: string[] | null;
          updated_at: string;
        };
        Insert: {
          birth_date?: string | null;
          stats_blocks?: string[] | null;
          counter_order?: string[] | null;
          user_id?: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          stats_blocks?: string[] | null;
          counter_order?: string[] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      hidden_counters: {
        Row: { user_id: string; counter_id: string };
        Insert: { counter_id: string; user_id?: string };
        Update: never;
        Relationships: [];
      };
      home_removed_counters: {
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
      my_counter_streaks: {
        Row: {
          counter_id: string;
          current_total: number;
          current_days: number;
          best_total: number;
          best_days: number;
          today_done: boolean | null;
          today_amount: number | null;
        };
        Relationships: [];
      };
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
          active_today: boolean;
        }[];
      };
      decide_counter_request: {
        Args: { p_request_id: string; p_approve: boolean };
        Returns: undefined;
      };
      transfer_group_admin: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: undefined;
      };
      resign_group_admin: {
        Args: { p_group_id: string };
        Returns: string;
      };
      leave_group: {
        Args: { p_group_id: string };
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
          their_total: number | null;
          my_total: number | null;
        }[];
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      undo_last_entry: {
        Args: { p_counter_id: string };
        Returns: boolean;
      };
      set_my_time_zone: {
        Args: { p_time_zone: string };
        Returns: undefined;
      };
      get_my_home: {
        Args: Record<string, never>;
        Returns: HomeBundle;
      };
      get_group_counter_daily: {
        Args: { p_counter_id: string };
        Returns: { user_id: string; day: string; total: number }[];
      };
      get_streak_leaderboard: {
        Args: { p_counter_id: string };
        Returns: {
          user_id: string;
          username: string;
          display_name: string;
          total: number;
          best: number;
          position: number;
        }[];
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
