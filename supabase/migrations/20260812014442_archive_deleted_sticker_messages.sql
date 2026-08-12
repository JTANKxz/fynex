create or replace function private.archive_deleted_sticker_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages
  set message_kind = 'text',
      sticker_id = null,
      content = case when btrim(content) = '' then 'Figurinha removida.' else content end
  where sticker_id = old.id;
  return old;
end;
$$;

revoke all on function private.archive_deleted_sticker_messages() from public, anon, authenticated;

drop trigger if exists archive_deleted_sticker_messages on public.community_stickers;
create trigger archive_deleted_sticker_messages
before delete on public.community_stickers
for each row execute function private.archive_deleted_sticker_messages();
