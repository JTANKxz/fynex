create table public.community_invite_links (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  token text not null default encode(gen_random_bytes(18), 'hex'),
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz,
  max_uses integer,
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint community_invite_links_token_unique unique (token),
  constraint community_invite_links_max_uses_check check (max_uses is null or max_uses between 1 and 10000),
  constraint community_invite_links_use_count_check check (use_count >= 0)
);

create index community_invite_links_community_idx
  on public.community_invite_links (community_id, created_at desc);
create index community_invite_links_active_token_idx
  on public.community_invite_links (token)
  where revoked_at is null;

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_distinct_users check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id, blocker_id);

create table public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_conversations_distinct_users check (user_a <> user_b),
  constraint direct_conversations_canonical_order check (user_a::text < user_b::text),
  constraint direct_conversations_pair_unique unique (user_a, user_b)
);

create index direct_conversations_user_b_idx on public.direct_conversations (user_b, updated_at desc);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint direct_messages_content_check check (char_length(btrim(content)) between 1 and 2000)
);

create index direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at desc);
create index direct_messages_author_idx on public.direct_messages (author_id);

create or replace function private.is_direct_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.direct_conversations conversation
    where conversation.id = target_conversation_id
      and (select auth.uid()) in (conversation.user_a, conversation.user_b)
  );
$$;

create or replace function private.users_are_blocked(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_blocks block
    where (block.blocker_id = first_user_id and block.blocked_id = second_user_id)
       or (block.blocker_id = second_user_id and block.blocked_id = first_user_id)
  );
$$;

create or replace function public.get_community_invite(invite_token text)
returns table (community_id uuid, community_name text, community_description text, community_avatar_url text, community_accent_color text, join_policy text)
language sql
stable
security definer
set search_path = ''
as $$
  select community.id, community.name, community.description, community.avatar_url, community.accent_color, community.join_policy
  from public.community_invite_links invite
  join public.communities community on community.id = invite.community_id
  where invite.token = invite_token
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > now())
    and (invite.max_uses is null or invite.use_count < invite.max_uses)
  limit 1;
$$;

create or replace function public.redeem_community_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_invite public.community_invite_links%rowtype;
  selected_policy text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  select * into selected_invite
  from public.community_invite_links invite
  where invite.token = invite_token
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > now())
    and (invite.max_uses is null or invite.use_count < invite.max_uses)
  for update;

  if selected_invite.id is null then
    raise exception 'invalid or expired invite';
  end if;

  if exists (
    select 1 from public.community_bans ban
    where ban.community_id = selected_invite.community_id
      and ban.user_id = (select auth.uid())
  ) then
    raise exception 'user is banned from this community';
  end if;

  if exists (
    select 1 from public.community_members member
    where member.community_id = selected_invite.community_id
      and member.user_id = (select auth.uid())
  ) then
    return selected_invite.community_id;
  end if;

  select community.join_policy into selected_policy
  from public.communities community
  where community.id = selected_invite.community_id;

  if selected_policy = 'open' then
    insert into public.community_members (community_id, user_id, role)
    values (selected_invite.community_id, (select auth.uid()), 'member')
    on conflict (community_id, user_id) do nothing;
  else
    insert into public.community_join_requests (community_id, user_id)
    values (selected_invite.community_id, (select auth.uid()))
    on conflict do nothing;
  end if;

  update public.community_invite_links
  set use_count = use_count + 1
  where id = selected_invite.id;

  return selected_invite.community_id;
end;
$$;

alter table public.community_invite_links enable row level security;
alter table public.user_blocks enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

create policy "Members can view community invite links"
  on public.community_invite_links for select to authenticated
  using ((select private.is_community_member(community_id)));

create policy "Members can create community invite links"
  on public.community_invite_links for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_community_member(community_id))
  );

create policy "Creators and owners can update community invite links"
  on public.community_invite_links for update to authenticated
  using (
    created_by = (select auth.uid())
    or (select private.is_community_owner(community_id))
  )
  with check (
    created_by = (select auth.uid())
    or (select private.is_community_owner(community_id))
  );

create policy "Creators and owners can delete community invite links"
  on public.community_invite_links for delete to authenticated
  using (
    created_by = (select auth.uid())
    or (select private.is_community_owner(community_id))
  );

create policy "Users can view their blocks"
  on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "Users can block other users"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()) and blocked_id <> (select auth.uid()));

create policy "Users can remove their blocks"
  on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create policy "Participants can view direct conversations"
  on public.direct_conversations for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "Friends can create direct conversations"
  on public.direct_conversations for insert to authenticated
  with check (
    (select auth.uid()) in (user_a, user_b)
    and not (select private.users_are_blocked(user_a, user_b))
    and exists (
      select 1 from public.friendships friendship
      where friendship.user_a = direct_conversations.user_a
        and friendship.user_b = direct_conversations.user_b
        and friendship.status = 'accepted'
    )
  );

create policy "Participants can view direct messages"
  on public.direct_messages for select to authenticated
  using ((select private.is_direct_conversation_participant(conversation_id)));

create policy "Participants can send direct messages"
  on public.direct_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_direct_conversation_participant(conversation_id))
    and exists (
      select 1
      from public.direct_conversations conversation
      where conversation.id = direct_messages.conversation_id
        and not (select private.users_are_blocked(conversation.user_a, conversation.user_b))
    )
  );

create policy "Authors can update direct messages"
  on public.direct_messages for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors can delete direct messages"
  on public.direct_messages for delete to authenticated
  using (author_id = (select auth.uid()));

revoke all on public.community_invite_links, public.user_blocks, public.direct_conversations, public.direct_messages from anon;
revoke all on public.community_invite_links, public.user_blocks, public.direct_conversations, public.direct_messages from authenticated;
grant select, insert, delete on public.community_invite_links to authenticated;
grant update (expires_at, max_uses, revoked_at) on public.community_invite_links to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert on public.direct_conversations to authenticated;
grant select, insert, update, delete on public.direct_messages to authenticated;

revoke all on function private.is_direct_conversation_participant(uuid) from public, anon;
revoke all on function private.users_are_blocked(uuid, uuid) from public, anon;
grant execute on function private.is_direct_conversation_participant(uuid) to authenticated;
grant execute on function private.users_are_blocked(uuid, uuid) to authenticated;
revoke all on function public.get_community_invite(text) from public;
revoke all on function public.redeem_community_invite(text) from public, anon;
grant execute on function public.get_community_invite(text) to anon, authenticated;
grant execute on function public.redeem_community_invite(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end
$$;
