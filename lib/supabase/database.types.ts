export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; display_name: string; bio: string; avatar_url: string | null; avatar_file_id: string | null; banner_url: string | null; banner_file_id: string | null; accent_color: string; presence_status: "online" | "idle" | "dnd" | "invisible"; profile_song_id: string | null; profile_song_name: string | null; profile_song_artist: string | null; profile_song_cover_url: string | null; profile_song_preview_url: string | null; profile_song_spotify_url: string | null; profile_song_duration_ms: number | null; profile_song_start_seconds: number; created_at: string; updated_at: string };
        Insert: { id: string; username: string; display_name: string; bio?: string; avatar_url?: string | null; avatar_file_id?: string | null; banner_url?: string | null; banner_file_id?: string | null; accent_color?: string; presence_status?: "online" | "idle" | "dnd" | "invisible"; profile_song_id?: string | null; profile_song_name?: string | null; profile_song_artist?: string | null; profile_song_cover_url?: string | null; profile_song_preview_url?: string | null; profile_song_spotify_url?: string | null; profile_song_duration_ms?: number | null; profile_song_start_seconds?: number; created_at?: string; updated_at?: string };
        Update: { username?: string; display_name?: string; bio?: string; avatar_url?: string | null; avatar_file_id?: string | null; banner_url?: string | null; banner_file_id?: string | null; accent_color?: string; presence_status?: "online" | "idle" | "dnd" | "invisible"; profile_song_id?: string | null; profile_song_name?: string | null; profile_song_artist?: string | null; profile_song_cover_url?: string | null; profile_song_preview_url?: string | null; profile_song_spotify_url?: string | null; profile_song_duration_ms?: number | null; profile_song_start_seconds?: number; updated_at?: string };
        Relationships: [];
      };
      communities: {
        Row: { id: string; name: string; description: string; owner_id: string; accent_color: string; avatar_url: string | null; avatar_file_id: string | null; banner_url: string | null; banner_file_id: string | null; join_policy: string; discoverable: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; description?: string; owner_id: string; accent_color?: string; avatar_url?: string | null; avatar_file_id?: string | null; banner_url?: string | null; banner_file_id?: string | null; join_policy?: string; discoverable?: boolean; created_at?: string; updated_at?: string };
        Update: { name?: string; description?: string; owner_id?: string; accent_color?: string; avatar_url?: string | null; avatar_file_id?: string | null; banner_url?: string | null; banner_file_id?: string | null; join_policy?: string; discoverable?: boolean; updated_at?: string };
        Relationships: [{ foreignKeyName: "communities_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      community_members: {
        Row: { community_id: string; user_id: string; role: string; nickname: string | null; server_bio: string | null; server_accent_color: string | null; display_role_id: string | null; joined_at: string };
        Insert: { community_id: string; user_id: string; role?: string; nickname?: string | null; server_bio?: string | null; server_accent_color?: string | null; display_role_id?: string | null; joined_at?: string };
        Update: { role?: string; nickname?: string | null; server_bio?: string | null; server_accent_color?: string | null; display_role_id?: string | null };
        Relationships: [
          { foreignKeyName: "community_members_community_id_fkey"; columns: ["community_id"]; isOneToOne: false; referencedRelation: "communities"; referencedColumns: ["id"] },
          { foreignKeyName: "community_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      community_pairs: {
        Row: { id: string; community_id: string; requester_id: string; recipient_id: string; status: "pending" | "accepted" | "declined"; created_at: string; responded_at: string | null };
        Insert: { id?: string; community_id: string; requester_id: string; recipient_id: string; status?: "pending" | "accepted" | "declined"; created_at?: string; responded_at?: string | null };
        Update: { status?: "pending" | "accepted" | "declined"; responded_at?: string | null };
        Relationships: [];
      };
      community_roles: {
        Row: { id: string; community_id: string; name: string; color: string; color_mode: "solid" | "rgb"; icon: string; custom_icon_id: string | null; position: number; is_admin: boolean; manage_channels: boolean; manage_roles: boolean; manage_messages: boolean; manage_members: boolean; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; community_id: string; name: string; color?: string; color_mode?: "solid" | "rgb"; icon?: string; custom_icon_id?: string | null; position?: number; is_admin?: boolean; manage_channels?: boolean; manage_roles?: boolean; manage_messages?: boolean; manage_members?: boolean; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; color?: string; color_mode?: "solid" | "rgb"; icon?: string; custom_icon_id?: string | null; position?: number; is_admin?: boolean; manage_channels?: boolean; manage_roles?: boolean; manage_messages?: boolean; manage_members?: boolean; created_by?: string | null; updated_at?: string };
        Relationships: [];
      };
      community_role_icons: {
        Row: { id: string; community_id: string; name: string; image_url: string; image_file_id: string; image_path: string; mime_type: "image/png" | "image/svg+xml"; file_size: number; created_by: string; created_at: string };
        Insert: { id?: string; community_id: string; name: string; image_url: string; image_file_id: string; image_path: string; mime_type: "image/png" | "image/svg+xml"; file_size: number; created_by: string; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      community_member_roles: {
        Row: { community_id: string; user_id: string; role_id: string; assigned_by: string | null; assigned_at: string };
        Insert: { community_id: string; user_id: string; role_id: string; assigned_by?: string | null; assigned_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      community_tags: {
        Row: { id: string; community_id: string; name: string; color: string; created_by: string; created_at: string };
        Insert: { id?: string; community_id: string; name: string; color?: string; created_by: string; created_at?: string };
        Update: { name?: string; color?: string };
        Relationships: [];
      };
      community_member_tags: {
        Row: { community_id: string; user_id: string; tag_id: string; assigned_by: string; assigned_at: string };
        Insert: { community_id: string; user_id: string; tag_id: string; assigned_by: string; assigned_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      community_stickers: {
        Row: { id: string; community_id: string; name: string; image_url: string; image_file_id: string; image_path: string; created_by: string; created_at: string };
        Insert: { id?: string; community_id: string; name: string; image_url: string; image_file_id: string; image_path: string; created_by: string; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      channels: {
        Row: { id: string; community_id: string; category_id: string | null; name: string; type: string; position: number; created_by: string | null; user_limit: number | null; created_at: string };
        Insert: { id?: string; community_id: string; category_id?: string | null; name: string; type: string; position?: number; created_by?: string | null; user_limit?: number | null; created_at?: string };
        Update: { category_id?: string | null; name?: string; type?: string; position?: number; user_limit?: number | null };
        Relationships: [{ foreignKeyName: "channels_community_id_fkey"; columns: ["community_id"]; isOneToOne: false; referencedRelation: "communities"; referencedColumns: ["id"] }];
      };
      channel_categories: {
        Row: { id: string; community_id: string; name: string; position: number; created_by: string | null; created_at: string };
        Insert: { id?: string; community_id: string; name: string; position?: number; created_by?: string | null; created_at?: string };
        Update: { name?: string; position?: number };
        Relationships: [];
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
      community_invite_links: {
        Row: { id: string; community_id: string; token: string; created_by: string; expires_at: string | null; max_uses: number | null; use_count: number; revoked_at: string | null; created_at: string };
        Insert: { id?: string; community_id: string; token?: string; created_by: string; expires_at?: string | null; max_uses?: number | null; use_count?: number; revoked_at?: string | null; created_at?: string };
        Update: { expires_at?: string | null; max_uses?: number | null; use_count?: number; revoked_at?: string | null };
        Relationships: [];
      };
      user_blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: { blocker_id: string; blocked_id: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      direct_conversations: {
        Row: { id: string; user_a: string; user_b: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_a: string; user_b: string; created_at?: string; updated_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      direct_messages: {
        Row: { id: string; conversation_id: string; author_id: string; content: string; created_at: string; edited_at: string | null };
        Insert: { id?: string; conversation_id: string; author_id: string; content: string; created_at?: string; edited_at?: string | null };
        Update: { content?: string; edited_at?: string | null };
        Relationships: [];
      };
      direct_message_reads: {
        Row: { conversation_id: string; user_id: string; last_read_at: string };
        Insert: { conversation_id: string; user_id: string; last_read_at?: string };
        Update: { last_read_at?: string };
        Relationships: [];
      };
      messages: {
        Row: { id: string; channel_id: string; author_id: string; content: string; created_at: string; edited_at: string | null; reply_to_id: string | null; message_kind: "text" | "poll" | "sticker" | "system"; poll_question: string | null; poll_options: string[] | null; sticker_id: string | null; attachment_kind: string | null; attachment_url: string | null; attachment_file_id: string | null; attachment_path: string | null; attachment_mime: string | null; attachment_size: number | null; attachment_width: number | null; attachment_height: number | null; attachment_name: string | null; link_preview_url: string | null; link_preview_title: string | null; link_preview_description: string | null; link_preview_site_name: string | null };
        Insert: { id?: string; channel_id: string; author_id: string; content?: string; created_at?: string; edited_at?: string | null; reply_to_id?: string | null; message_kind?: "text" | "poll" | "sticker" | "system"; poll_question?: string | null; poll_options?: string[] | null; sticker_id?: string | null; attachment_kind?: string | null; attachment_url?: string | null; attachment_file_id?: string | null; attachment_path?: string | null; attachment_mime?: string | null; attachment_size?: number | null; attachment_width?: number | null; attachment_height?: number | null; attachment_name?: string | null; link_preview_url?: string | null; link_preview_title?: string | null; link_preview_description?: string | null; link_preview_site_name?: string | null };
        Update: { content?: string; edited_at?: string | null; reply_to_id?: string | null; message_kind?: "text" | "poll" | "sticker" | "system"; poll_question?: string | null; poll_options?: string[] | null; sticker_id?: string | null; attachment_kind?: string | null; attachment_url?: string | null; attachment_file_id?: string | null; attachment_path?: string | null; attachment_mime?: string | null; attachment_size?: number | null; attachment_width?: number | null; attachment_height?: number | null; attachment_name?: string | null; link_preview_url?: string | null; link_preview_title?: string | null; link_preview_description?: string | null; link_preview_site_name?: string | null };
        Relationships: [
          { foreignKeyName: "messages_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_channel_id_fkey"; columns: ["channel_id"]; isOneToOne: false; referencedRelation: "channels"; referencedColumns: ["id"] },
        ];
      };
      message_reactions: {
        Row: { message_id: string; user_id: string; emoji: string; created_at: string };
        Insert: { message_id: string; user_id: string; emoji: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      community_bans: {
        Row: { community_id: string; user_id: string; banned_by: string; reason: string; created_at: string };
        Insert: { community_id: string; user_id: string; banned_by: string; reason?: string; created_at?: string };
        Update: { reason?: string };
        Relationships: [];
      };
      voice_moderation_events: {
        Row: { id: string; community_id: string; channel_id: string; target_user_id: string; actor_id: string; action: "mute" | "disconnect"; created_at: string };
        Insert: { id?: string; community_id: string; channel_id: string; target_user_id: string; actor_id: string; action: "mute" | "disconnect"; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      poll_votes: {
        Row: { message_id: string; user_id: string; option_index: number; created_at: string };
        Insert: { message_id: string; user_id: string; option_index: number; created_at?: string };
        Update: { option_index?: number };
        Relationships: [];
      };
      channel_read_states: {
        Row: { user_id: string; channel_id: string; last_read_at: string };
        Insert: { user_id: string; channel_id: string; last_read_at?: string };
        Update: { last_read_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      delete_current_account: { Args: Record<PropertyKey, never>; Returns: boolean };
      get_unread_community_counts: { Args: Record<PropertyKey, never>; Returns: { community_id: string; unread_count: number }[] };
      get_mutual_friends: { Args: { target_user_id: string }; Returns: { id: string; username: string; display_name: string; avatar_url: string | null; accent_color: string }[] };
      get_community_invite: { Args: { invite_token: string }; Returns: { community_id: string; community_name: string; community_description: string; community_avatar_url: string | null; community_accent_color: string; join_policy: string }[] };
      redeem_community_invite: { Args: { invite_token: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Community = Database["public"]["Tables"]["communities"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type CommunityRole = Database["public"]["Tables"]["community_roles"]["Row"];
export type CommunityRoleIcon = Database["public"]["Tables"]["community_role_icons"]["Row"];
export type CommunityRoleWithIcon = CommunityRole & { customIcon?: CommunityRoleIcon | null };
export type CommunityMemberRole = Database["public"]["Tables"]["community_member_roles"]["Row"];
export type CommunityTag = Database["public"]["Tables"]["community_tags"]["Row"];
export type CommunityMemberTag = Database["public"]["Tables"]["community_member_tags"]["Row"];
export type CommunitySticker = Database["public"]["Tables"]["community_stickers"]["Row"];
export type CommunityPair = Database["public"]["Tables"]["community_pairs"]["Row"];
export type MessageReaction = Database["public"]["Tables"]["message_reactions"]["Row"];
export type VoiceModerationEvent = Database["public"]["Tables"]["voice_moderation_events"]["Row"];
export type PollVote = Database["public"]["Tables"]["poll_votes"]["Row"];
export type CommunityInviteLink = Database["public"]["Tables"]["community_invite_links"]["Row"];
export type DirectConversation = Database["public"]["Tables"]["direct_conversations"]["Row"];
export type DirectMessage = Database["public"]["Tables"]["direct_messages"]["Row"];
export type DirectMessageRead = Database["public"]["Tables"]["direct_message_reads"]["Row"];
export type ChannelCategory = Database["public"]["Tables"]["channel_categories"]["Row"];
