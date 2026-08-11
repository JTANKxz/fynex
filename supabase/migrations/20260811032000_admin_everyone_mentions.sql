create or replace function private.validate_message_everyone_mention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_community_id uuid;
begin
  if new.content ~* '(^|[[:space:]])@todos([^[:alnum:]_]|$)' then
    select channel.community_id into target_community_id
    from public.channels channel
    where channel.id = new.channel_id;

    if target_community_id is null
      or not private.has_community_permission(target_community_id, 'admin') then
      raise exception 'Only community administrators can mention everyone'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_message_everyone_mention_before_write on public.messages;
create trigger validate_message_everyone_mention_before_write
before insert or update of content, channel_id on public.messages
for each row execute function private.validate_message_everyone_mention();

revoke all on function private.validate_message_everyone_mention() from public, anon, authenticated;
