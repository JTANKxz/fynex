export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; display_name: string; bio: string; avatar_url: string | null; avatar_file_id: string | null; banner_url: string | null; banner_file_id: string | null; accent_color: string; created_at: string; updated_at: string };
        Insert: { id: string; username: string; display_name: string; bio?: string; avatar_url?: string | null; avatar_file_id?: string | null; banner_url?: string | null; banner_file_id?: string | null; accent_color?: string; created_at?: string; updated_at?: string };
        Update: { username?: string; display_name?: string; bio?: string; avatar_url?: string | null; avatar_file_id?: string | null; banner_url?: string | null; banner_file_id?: string | null; accent_color?: string; updated_at?: string };
        Relationships: [];
      };
      communities: {
        Row: { id: string; name: string; description: string; owner_id: string; accent_color: string; join_policy: string; discoverable: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; description?: string; owner_id: string; accent_color?: string; join_policy?: string; discoverable?: boolean; created_at?: string; updated_at?: string };
        Update: { name?: string; description?: string; owner_id?: string; accent_color?: string; join_policy?: string; discoverable?: boolean; updated_at?: string };
        Relationships: [{ foreignKeyName: "communities_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      community_members: {
        Row: { community_id: string; user_id: string; role: string; joined_at: string };
        Insert: { community_id: string; user_id: string; role?: string; joined_at?: string };
        Update: { role?: string };
        Relationships: [
          { foreignKeyName: "community_members_community_id_fkey"; columns: ["community_id"]; isOneToOne: false; referencedRelation: "communities"; referencedColumns: ["id"] },
          { foreignKeyName: "community_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      channels: {
        Row: { id: string; community_id: string; name: string; type: string; position: number; created_at: string };
        Insert: { id?: string; community_id: string; name: string; type: string; position?: number; created_at?: string };
        Update: { name?: string; type?: string; position?: number };
        Relationships: [{ foreignKeyName: "channels_community_id_fkey"; columns: ["community_id"]; isOneToOne: false; referencedRelation: "communities"; referencedColumns: ["id"] }];
      };
      friendships: {
        Row: { user_a: string; user_b: string; requested_by: string; status: string; created_at: string; responded_at: string | null };
        Insert: { user_a: string; user_b: string; requested_by: string; status?: string; created_at?: string; responded_at?: string | null };
        Update: { status?: string; responded_at?: string | null };
        Relationships: [];
      };
      community_invitations: {
        Row: { id: string; community_id: string; inviter_id: string; invitee_id: string; status: string; created_at: string; responded_at: string | null };
        Insert: { id?: string; community_id: string; inviter_id: string; invitee_id: string; status?: string; created_at?: string; responded_at?: string | null };
        Update: { status?: string; responded_at?: string | null };
        Relationships: [];
      };
      community_join_requests: {
        Row: { id: string; community_id: string; user_id: string; status: string; reviewed_by: string | null; created_at: string; reviewed_at: string | null };
        Insert: { id?: string; community_id: string; user_id: string; status?: string; reviewed_by?: string | null; created_at?: string; reviewed_at?: string | null };
        Update: { status?: string; reviewed_by?: string | null; reviewed_at?: string | null };
        Relationships: [];
      };
      messages: {
        Row: { id: string; channel_id: string; author_id: string; content: string; created_at: string; edited_at: string | null };
        Insert: { id?: string; channel_id: string; author_id: string; content: string; created_at?: string; edited_at?: string | null };
        Update: { content?: string; edited_at?: string | null };
        Relationships: [
          { foreignKeyName: "messages_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_channel_id_fkey"; columns: ["channel_id"]; isOneToOne: false; referencedRelation: "channels"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Community = Database["public"]["Tables"]["communities"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
