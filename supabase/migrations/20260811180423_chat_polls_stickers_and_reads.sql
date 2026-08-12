-- Enquetes, figurinhas integradas e estado persistente de leitura.

alter table public.messages
  add column message_kind text not null default 'text',
  add column poll_question text,
  add column poll_options jsonb,
  add column sticker_id text;

alter table public.messages
  drop constraint messages_content_length,
  add constraint messages_kind_check check (message_kind in ('text', 'poll', 'sticker')),
  add constraint messages_content_length check (
    content = btrim(content)
    and char_length(content) <= 2000
    and (
      char_length(content) >= 1
      or attachment_url is not null
      or message_kind in ('poll', 'sticker')
    )
  ),
  add constraint messages_poll_shape_check check (
    (message_kind <> 'poll' and poll_question is null and poll_options is null)
    or (
      message_kind = 'poll'
      and poll_question = btrim(poll_question)
      and char_length(poll_question) between 1 and 160
      and jsonb_typeof(poll_options) = 'array'
      and jsonb_array_length(poll_options) between 2 and 6
    )
  ),
  add constraint messages_sticker_shape_check check (
    (message_kind <> 'sticker' and sticker_id is null)
    or (message_kind = 'sticker' and sticker_id in ('hello', 'love', 'laugh', 'wow', 'party', 'gg'))
  );

create table public.poll_votes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index smallint not null check (option_index between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index poll_votes_message_option_idx
  on public.poll_votes (message_id, option_index);

create table public.channel_read_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create index channel_read_states_channel_idx
  on public.channel_read_states (channel_id, user_id);

alter table public.poll_votes enable row level security;
alter table public.channel_read_states enable row level security;

create policy "Community members can view poll votes"
  on public.poll_votes for select to authenticated
  using (exists (
    select 1
    from public.messages message
    where message.id = poll_votes.message_id
      and message.message_kind = 'poll'
      and (select private.can_access_channel(message.channel_id, 'text'))
  ));

create policy "Members can cast one valid poll vote"
  on public.poll_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.messages message
      where message.id = poll_votes.message_id
        and message.message_kind = 'poll'
        and poll_votes.option_index < jsonb_array_length(message.poll_options)
        and (select private.can_access_channel(message.channel_id, 'text'))
    )
  );

create policy "Members can change their own poll vote"
  on public.poll_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.messages message
      where message.id = poll_votes.message_id
        and message.message_kind = 'poll'
        and poll_votes.option_index < jsonb_array_length(message.poll_options)
        and (select private.can_access_channel(message.channel_id, 'text'))
    )
  );

create policy "Members can remove their own poll vote"
  on public.poll_votes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can view their own read states"
  on public.channel_read_states for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own read states"
  on public.channel_read_states for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.can_access_channel(channel_id, 'text'))
  );

create policy "Users can update their own read states"
  on public.channel_read_states for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (select private.can_access_channel(channel_id, 'text'))
  );

create or replace function public.get_unread_community_counts()
returns table (community_id uuid, unread_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select channel.community_id, count(message.id)::bigint
  from public.community_members membership
  join public.channels channel
    on channel.community_id = membership.community_id
   and channel.type = 'text'
  join public.messages message on message.channel_id = channel.id
  left join public.channel_read_states read_state
    on read_state.channel_id = channel.id
   and read_state.user_id = membership.user_id
  where membership.user_id = (select auth.uid())
    and message.author_id <> membership.user_id
    and message.created_at > coalesce(read_state.last_read_at, membership.joined_at)
  group by channel.community_id;
$$;

revoke all on public.poll_votes, public.channel_read_states from anon;
revoke all on public.poll_votes, public.channel_read_states from authenticated;
grant select, insert, update, delete on public.poll_votes to authenticated;
grant select, insert, update on public.channel_read_states to authenticated;

revoke all on function public.get_unread_community_counts() from public, anon;
grant execute on function public.get_unread_community_counts() to authenticated;

alter table public.poll_votes replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_votes'
  ) then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
end
$$;
