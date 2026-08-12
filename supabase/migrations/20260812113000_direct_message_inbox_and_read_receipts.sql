create table public.direct_message_reads (
  conversation_id uuid not null references public.direct_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index direct_message_reads_user_idx on public.direct_message_reads (user_id, last_read_at desc);

alter table public.direct_message_reads enable row level security;

create policy "Participants can view their direct read state" on public.direct_message_reads for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_direct_conversation_participant(conversation_id)));
create policy "Participants can create their direct read state" on public.direct_message_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_direct_conversation_participant(conversation_id)));
create policy "Participants can update their direct read state" on public.direct_message_reads for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_direct_conversation_participant(conversation_id)))
  with check (user_id = (select auth.uid()) and (select private.is_direct_conversation_participant(conversation_id)));

grant select, insert, update on public.direct_message_reads to authenticated;
revoke all on public.direct_message_reads from anon;

create or replace function private.touch_direct_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.direct_conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_direct_conversation_on_message on public.direct_messages;
create trigger touch_direct_conversation_on_message after insert on public.direct_messages
for each row execute function private.touch_direct_conversation_on_message();

revoke all on function private.touch_direct_conversation_on_message() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_conversations') then
    alter publication supabase_realtime add table public.direct_conversations;
  end if;
end
$$;
