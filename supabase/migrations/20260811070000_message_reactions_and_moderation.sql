-- Reações persistentes e comandos seguros de moderação de voz.

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji),
  constraint message_reactions_emoji_check check (char_length(emoji) between 1 and 16)
);

create index message_reactions_message_created_idx
  on public.message_reactions (message_id, created_at);

create table public.community_bans (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (community_id, user_id),
  constraint community_bans_reason_check check (char_length(reason) <= 240)
);

create table public.voice_moderation_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('mute', 'disconnect')),
  created_at timestamptz not null default now()
);

create index voice_moderation_target_created_idx
  on public.voice_moderation_events (target_user_id, created_at desc);

create or replace function private.can_react_to_message(target_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.messages message
    join public.channels channel on channel.id = message.channel_id
    where message.id = target_message_id
      and (select private.is_community_member(channel.community_id))
  );
$$;

create or replace function private.prevent_banned_community_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.community_bans ban
    where ban.community_id = new.community_id
      and ban.user_id = new.user_id
  ) then
    raise exception 'User is banned from this community'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger prevent_banned_community_membership_before_insert
before insert on public.community_members
for each row execute function private.prevent_banned_community_membership();

alter table public.message_reactions enable row level security;
alter table public.community_bans enable row level security;
alter table public.voice_moderation_events enable row level security;

create policy "Community members can view reactions"
  on public.message_reactions for select to authenticated
  using ((select private.can_react_to_message(message_id)));

create policy "Community members can add own reactions"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.can_react_to_message(message_id))
  );

create policy "Members can remove own reactions"
  on public.message_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Managers and affected users can view bans"
  on public.community_bans for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_community_permission(community_id, 'manage_members'))
  );

create policy "Member managers can ban lower members"
  on public.community_bans for insert to authenticated
  with check (
    banned_by = (select auth.uid())
    and (select private.can_manage_community_member(community_id, user_id))
  );

create policy "Member managers can remove bans"
  on public.community_bans for delete to authenticated
  using ((select private.has_community_permission(community_id, 'manage_members')));

create policy "Targets and managers can view voice moderation"
  on public.voice_moderation_events for select to authenticated
  using (
    target_user_id = (select auth.uid())
    or (select private.has_community_permission(community_id, 'manage_members'))
  );

create policy "Member managers can moderate voice"
  on public.voice_moderation_events for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (select private.can_manage_community_member(community_id, target_user_id))
    and exists (
      select 1 from public.channels channel
      where channel.id = voice_moderation_events.channel_id
        and channel.community_id = voice_moderation_events.community_id
        and channel.type = 'voice'
    )
  );

revoke all on public.message_reactions, public.community_bans, public.voice_moderation_events from anon;
revoke all on public.message_reactions, public.community_bans, public.voice_moderation_events from authenticated;
grant select, insert, delete on public.message_reactions to authenticated;
grant select, insert, delete on public.community_bans to authenticated;
grant select, insert on public.voice_moderation_events to authenticated;

revoke all on function private.can_react_to_message(uuid) from public, anon;
grant execute on function private.can_react_to_message(uuid) to authenticated;
revoke all on function private.prevent_banned_community_membership() from public, anon, authenticated;

alter table public.message_reactions replica identity full;
alter table public.voice_moderation_events replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'voice_moderation_events'
  ) then
    alter publication supabase_realtime add table public.voice_moderation_events;
  end if;
end
$$;
