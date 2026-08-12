create or replace function private.protect_community_creator_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    raise exception 'Community ownership cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_community_creator_identity_before_update
before update of owner_id on public.communities
for each row execute function private.protect_community_creator_identity();

revoke all on function private.protect_community_creator_identity() from public, anon, authenticated;
