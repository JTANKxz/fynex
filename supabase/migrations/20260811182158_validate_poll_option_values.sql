create or replace function private.valid_poll_options(options jsonb)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 6
    and count(*) = count(distinct lower(btrim(item.value #>> '{}')))
    and bool_and(
      jsonb_typeof(item.value) = 'string'
      and char_length(btrim(item.value #>> '{}')) between 1 and 80
    )
  from jsonb_array_elements(options) as item(value);
$$;

alter table public.messages
  drop constraint messages_poll_shape_check,
  add constraint messages_poll_shape_check check (
    (message_kind <> 'poll' and poll_question is null and poll_options is null)
    or (
      message_kind = 'poll'
      and poll_question = btrim(poll_question)
      and char_length(poll_question) between 1 and 160
      and private.valid_poll_options(poll_options)
    )
  );

revoke all on function private.valid_poll_options(jsonb) from public, anon, authenticated;
