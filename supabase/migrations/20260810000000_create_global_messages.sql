create table if not exists public.messages (
  id uuid primary key,
  channel text not null default 'geral' check (channel = 'geral'),
  session_id uuid not null,
  username varchar(24) not null check (char_length(btrim(username)) between 1 and 24),
  color varchar(7) not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  content varchar(2000) not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_channel_created_at_idx
  on public.messages (channel, created_at desc);

alter table public.messages enable row level security;

revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to anon, authenticated;
grant insert (id, channel, session_id, username, color, content)
  on table public.messages to anon, authenticated;

drop policy if exists "global messages are readable" on public.messages;
create policy "global messages are readable"
  on public.messages
  for select
  to anon, authenticated
  using (channel = 'geral');

drop policy if exists "visitors can send global messages" on public.messages;
create policy "visitors can send global messages"
  on public.messages
  for insert
  to anon, authenticated
  with check (
    channel = 'geral'
    and char_length(btrim(username)) between 1 and 24
    and char_length(btrim(content)) between 1 and 2000
    and color ~ '^#[0-9a-fA-F]{6}$'
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
