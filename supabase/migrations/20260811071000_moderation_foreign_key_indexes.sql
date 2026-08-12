-- Índices de apoio para junções, exclusões em cascata e auditoria de moderação.

create index community_bans_user_idx
  on public.community_bans (user_id);

create index community_bans_banned_by_idx
  on public.community_bans (banned_by);

create index message_reactions_user_idx
  on public.message_reactions (user_id);

create index voice_moderation_actor_idx
  on public.voice_moderation_events (actor_id);

create index voice_moderation_channel_idx
  on public.voice_moderation_events (channel_id);

create index voice_moderation_community_idx
  on public.voice_moderation_events (community_id);
