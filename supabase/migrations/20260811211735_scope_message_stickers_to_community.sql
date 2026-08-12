-- Preserve legacy sticker messages as text before switching to real,
-- community-owned sticker records.
update public.messages
set content = case when btrim(content) = '' then 'Figurinha antiga indisponível.' else content end,
    message_kind = 'text',
    sticker_id = null
where message_kind = 'sticker'
  and not exists (
    select 1 from public.community_stickers sticker where sticker.id::text = messages.sticker_id
  );

alter table public.messages
  drop constraint messages_sticker_shape_check;

alter table public.messages
  alter column sticker_id type uuid using sticker_id::uuid,
  add constraint messages_sticker_id_fkey
    foreign key (sticker_id) references public.community_stickers(id) on delete restrict,
  add constraint messages_sticker_shape_check check (
    (message_kind <> 'sticker' and sticker_id is null)
    or (message_kind = 'sticker' and sticker_id is not null)
  );

create or replace function private.ensure_message_sticker_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  channel_community_id uuid;
  sticker_community_id uuid;
begin
  if new.message_kind <> 'sticker' then
    return new;
  end if;

  select community_id into channel_community_id
  from public.channels
  where id = new.channel_id;

  select community_id into sticker_community_id
  from public.community_stickers
  where id = new.sticker_id;

  if channel_community_id is null
    or sticker_community_id is null
    or channel_community_id <> sticker_community_id then
    raise exception 'sticker does not belong to the channel community' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.ensure_message_sticker_scope() from public, anon, authenticated;

create trigger messages_validate_sticker_scope
before insert or update of channel_id, message_kind, sticker_id
on public.messages
for each row execute function private.ensure_message_sticker_scope();
