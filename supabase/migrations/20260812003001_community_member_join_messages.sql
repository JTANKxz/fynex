-- Announce an accepted community membership in the first text channel.
-- The community creator is intentionally excluded: creating a community should
-- not add a redundant "joined" event to its first channel.

alter table public.messages
  drop constraint messages_kind_check,
  add constraint messages_kind_check check (message_kind in ('text', 'poll', 'sticker', 'system'));

create or replace function private.announce_community_member_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_channel_id uuid;
  member_display_name text;
begin
  if new.role = 'owner' then
    return new;
  end if;

  select channel.id
    into target_channel_id
  from public.channels as channel
  where channel.community_id = new.community_id
    and channel.type = 'text'
  order by
    case when lower(channel.name) = 'geral' then 0 else 1 end,
    channel.position,
    channel.created_at
  limit 1;

  if target_channel_id is null then
    return new;
  end if;

  select profile.display_name
    into member_display_name
  from public.profiles as profile
  where profile.id = new.user_id;

  if nullif(btrim(member_display_name), '') is null then
    return new;
  end if;

  insert into public.messages (channel_id, author_id, content, message_kind)
  values (
    target_channel_id,
    new.user_id,
    left(btrim(member_display_name), 80) || ' entrou na comunidade.',
    'system'
  );

  return new;
end;
$$;

revoke all on function private.announce_community_member_join() from public, anon, authenticated;

drop trigger if exists community_members_announce_join on public.community_members;
create trigger community_members_announce_join
after insert on public.community_members
for each row
execute function private.announce_community_member_join();
