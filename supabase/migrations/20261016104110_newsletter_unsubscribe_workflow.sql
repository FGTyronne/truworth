alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token text,
  add column if not exists unsubscribe_reason text,
  add column if not exists unsubscribe_reason_detail text;

update public.newsletter_subscribers
set unsubscribe_token = encode(gen_random_bytes(32), 'hex')
where unsubscribe_token is null;

alter table public.newsletter_subscribers
  alter column unsubscribe_token set not null;

create unique index if not exists newsletter_subscribers_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token);

alter table public.newsletter_subscribers
  drop constraint if exists newsletter_subscribers_unsubscribe_token_length;
alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_unsubscribe_token_length
  check (char_length(unsubscribe_token) = 64);
