create or replace function private.can_delete_message(
  target_channel_id uuid,
  target_author_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channels channel
    join public.communities community on community.id = channel.community_id
    where channel.id = target_channel_id
      and private.has_community_permission(channel.community_id, 'manage_messages')
      and (
        community.owner_id = (select auth.uid())
        or target_author_id <> community.owner_id
      )
  );
$$;

drop policy if exists "Authors and moderators can delete messages" on public.messages;
create policy "Authors and moderators can delete messages"
  on public.messages for delete to authenticated
  using (
    author_id = (select auth.uid())
    or (select private.can_delete_message(channel_id, author_id))
  );

drop function if exists private.can_delete_message(uuid);
revoke all on function private.can_delete_message(uuid, uuid) from public, anon;
grant execute on function private.can_delete_message(uuid, uuid) to authenticated;
