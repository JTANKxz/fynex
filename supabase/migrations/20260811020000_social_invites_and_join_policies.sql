alter table public.communities
  add column join_policy text not null default 'admin_approval',
  add column discoverable boolean not null default true,
  add constraint communities_join_policy_check
    check (join_policy in ('open', 'admin_approval', 'member_approval'));

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (user_a, user_b),
  constraint friendships_distinct_users check (user_a <> user_b),
  constraint friendships_canonical_order check (user_a::text < user_b::text),
  constraint friendships_requester_participant check (requested_by in (user_a, user_b)),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'declined'))
);

create index friendships_user_b_idx on public.friendships (user_b, status);
create index friendships_requested_by_idx on public.friendships (requested_by);

create table public.community_invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint community_invitations_distinct_users check (inviter_id <> invitee_id),
  constraint community_invitations_status_check check (status in ('pending', 'accepted', 'declined'))
);

create unique index community_invitations_pending_unique_idx
  on public.community_invitations (community_id, invitee_id)
  where status = 'pending';
create index community_invitations_invitee_idx on public.community_invitations (invitee_id, status);
create index community_invitations_inviter_idx on public.community_invitations (inviter_id);

create table public.community_join_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint community_join_requests_status_check check (status in ('pending', 'approved', 'declined'))
);

create unique index community_join_requests_pending_unique_idx
  on public.community_join_requests (community_id, user_id)
  where status = 'pending';
create index community_join_requests_user_idx on public.community_join_requests (user_id, status);
create index community_join_requests_community_idx on public.community_join_requests (community_id, status, created_at);

create or replace function private.can_review_join_requests(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.communities community
      where community.id = target_community_id
        and (
          community.owner_id = (select auth.uid())
          or (
            community.join_policy = 'member_approval'
            and exists (
              select 1 from public.community_members membership
              where membership.community_id = community.id
                and membership.user_id = (select auth.uid())
            )
          )
        )
    );
$$;

revoke all on function private.can_review_join_requests(uuid) from public, anon;
grant execute on function private.can_review_join_requests(uuid) to authenticated;

alter table public.friendships enable row level security;
alter table public.community_invitations enable row level security;
alter table public.community_join_requests enable row level security;

drop policy if exists "Members and owners can view their communities" on public.communities;
drop policy if exists "Owners can add community members" on public.community_members;

create policy "Members owners and discovery can view communities"
  on public.communities for select to authenticated
  using (
    discoverable
    or owner_id = (select auth.uid())
    or (select private.is_community_member(id))
  );

create policy "Owners invited users and approved users can join"
  on public.community_members for insert to authenticated
  with check (
    (select private.is_community_owner(community_id))
    or (
      user_id = (select auth.uid())
      and role = 'member'
      and (
        exists (
          select 1 from public.communities community
          where community.id = community_members.community_id
            and community.join_policy = 'open'
        )
        or exists (
          select 1 from public.community_invitations invitation
          where invitation.community_id = community_members.community_id
            and invitation.invitee_id = (select auth.uid())
            and invitation.status = 'accepted'
        )
        or exists (
          select 1 from public.community_join_requests request
          where request.community_id = community_members.community_id
            and request.user_id = (select auth.uid())
            and request.status = 'approved'
        )
      )
    )
  );

create policy "Participants can view friendships"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "Users can request friendships"
  on public.friendships for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and (select auth.uid()) in (user_a, user_b)
  );

create policy "Recipients can answer friendships"
  on public.friendships for update to authenticated
  using (
    status = 'pending'
    and requested_by <> (select auth.uid())
    and (select auth.uid()) in (user_a, user_b)
  )
  with check (
    status in ('accepted', 'declined')
    and requested_by <> (select auth.uid())
    and (select auth.uid()) in (user_a, user_b)
  );

create policy "Participants can remove friendships"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "Related users can view community invitations"
  on public.community_invitations for select to authenticated
  using (
    inviter_id = (select auth.uid())
    or invitee_id = (select auth.uid())
    or (select private.is_community_owner(community_id))
  );

create policy "Members can invite friends"
  on public.community_invitations for insert to authenticated
  with check (
    inviter_id = (select auth.uid())
    and invitee_id <> (select auth.uid())
    and (select private.is_community_member(community_id))
  );

create policy "Invitees can answer community invitations"
  on public.community_invitations for update to authenticated
  using (invitee_id = (select auth.uid()) and status = 'pending')
  with check (invitee_id = (select auth.uid()) and status in ('accepted', 'declined'));

create policy "Related users can view join requests"
  on public.community_join_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.can_review_join_requests(community_id))
  );

create policy "Users can request community entry"
  on public.community_join_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not (select private.is_community_member(community_id))
  );

create policy "Authorized reviewers can answer join requests"
  on public.community_join_requests for update to authenticated
  using (status = 'pending' and (select private.can_review_join_requests(community_id)))
  with check (
    status in ('approved', 'declined')
    and reviewed_by = (select auth.uid())
    and (select private.can_review_join_requests(community_id))
  );

revoke all on public.friendships, public.community_invitations, public.community_join_requests from anon;
grant select, insert, delete on public.friendships to authenticated;
grant update (status, responded_at) on public.friendships to authenticated;
grant select, insert on public.community_invitations to authenticated;
grant update (status, responded_at) on public.community_invitations to authenticated;
grant select, insert on public.community_join_requests to authenticated;
grant update (status, reviewed_by, reviewed_at) on public.community_join_requests to authenticated;
