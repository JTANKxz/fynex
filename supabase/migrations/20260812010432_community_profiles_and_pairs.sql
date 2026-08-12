alter table public.community_members
  add column if not exists server_bio text,
  add column if not exists server_accent_color text,
  add constraint community_members_server_bio_length check (server_bio is null or char_length(btrim(server_bio)) between 1 and 190),
  add constraint community_members_server_accent_color_format check (server_accent_color is null or server_accent_color ~ '^#[0-9A-Fa-f]{6}$');

create table if not exists public.community_pairs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  requester_id uuid not null,
  recipient_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint community_pairs_distinct_people check (requester_id <> recipient_id),
  constraint community_pairs_requester_membership_fkey foreign key (community_id, requester_id) references public.community_members(community_id, user_id) on delete cascade,
  constraint community_pairs_recipient_membership_fkey foreign key (community_id, recipient_id) references public.community_members(community_id, user_id) on delete cascade
);

create index if not exists community_pairs_community_status_idx on public.community_pairs (community_id, status);
create index if not exists community_pairs_recipient_status_idx on public.community_pairs (recipient_id, status);

create or replace function private.validate_community_pair_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_id uuid;
  second_id uuid;
begin
  if new.status <> 'pending' then
    raise exception 'New pair requests must start pending';
  end if;
  first_id := least(new.requester_id, new.recipient_id);
  second_id := greatest(new.requester_id, new.recipient_id);
  perform pg_advisory_xact_lock(hashtextextended(new.community_id::text || ':' || first_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(new.community_id::text || ':' || second_id::text, 0));
  if exists (
    select 1 from public.community_pairs pair
    where pair.community_id = new.community_id
      and pair.status in ('pending', 'accepted')
      and (new.requester_id in (pair.requester_id, pair.recipient_id)
        or new.recipient_id in (pair.requester_id, pair.recipient_id))
  ) then
    raise exception 'One of these members already has a pending or accepted pair in this community';
  end if;
  return new;
end;
$$;

create or replace function private.protect_community_pair_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'pending'
     or new.community_id <> old.community_id
     or new.requester_id <> old.requester_id
     or new.recipient_id <> old.recipient_id
     or new.status not in ('accepted', 'declined') then
    raise exception 'Pair requests can only be accepted or declined once';
  end if;
  new.responded_at := now();
  return new;
end;
$$;

drop trigger if exists validate_community_pair_request on public.community_pairs;
create trigger validate_community_pair_request
before insert on public.community_pairs
for each row execute function private.validate_community_pair_request();

drop trigger if exists protect_community_pair_update on public.community_pairs;
create trigger protect_community_pair_update
before update on public.community_pairs
for each row execute function private.protect_community_pair_update();

alter table public.community_pairs enable row level security;
grant select, insert, update, delete on public.community_pairs to authenticated;

create policy "community members see accepted pairs and their requests"
on public.community_pairs for select to authenticated
using (
  private.is_community_member(community_id)
  and (status = 'accepted' or requester_id = (select auth.uid()) or recipient_id = (select auth.uid()))
);

create policy "members can request a pair"
on public.community_pairs for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and status = 'pending'
  and private.is_community_member(community_id)
);

create policy "recipient can answer a pair request"
on public.community_pairs for update to authenticated
using (recipient_id = (select auth.uid()) and status = 'pending' and private.is_community_member(community_id))
with check (recipient_id = (select auth.uid()) and status in ('accepted', 'declined') and private.is_community_member(community_id));

create policy "participants can remove their pending request"
on public.community_pairs for delete to authenticated
using ((requester_id = (select auth.uid()) or recipient_id = (select auth.uid())) and private.is_community_member(community_id));

alter table public.community_pairs replica identity full;
alter publication supabase_realtime add table public.community_pairs;
