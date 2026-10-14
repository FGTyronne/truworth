drop trigger if exists assessments_enforce_plan_limit on public.assessments;
drop function if exists public.enforce_assessment_limit();

create table if not exists public.guest_assessment_daily_usage (
  ip_hash text not null,
  usage_date date not null,
  assessment_count smallint not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (ip_hash, usage_date),
  constraint guest_assessment_daily_usage_count_check check (assessment_count between 0 and 3),
  constraint guest_assessment_daily_usage_hash_check check (length(ip_hash) = 64)
);

alter table public.guest_assessment_daily_usage enable row level security;
revoke all on table public.guest_assessment_daily_usage from anon, authenticated;
grant select, insert, update, delete on table public.guest_assessment_daily_usage to service_role;

create or replace function public.consume_guest_assessment(p_ip_hash text)
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (now() at time zone 'UTC')::date;
  v_count integer;
  v_allowed boolean;
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64 then
    raise exception 'Invalid guest quota key.' using errcode = '22023';
  end if;

  insert into public.guest_assessment_daily_usage (ip_hash, usage_date, assessment_count)
  values (p_ip_hash, v_date, 0)
  on conflict (ip_hash, usage_date) do nothing;

  select assessment_count
    into v_count
  from public.guest_assessment_daily_usage
  where ip_hash = p_ip_hash and usage_date = v_date
  for update;

  if v_count < 3 then
    update public.guest_assessment_daily_usage
      set assessment_count = assessment_count + 1,
          last_seen_at = now()
    where ip_hash = p_ip_hash and usage_date = v_date
    returning assessment_count into v_count;
    v_allowed := true;
  else
    update public.guest_assessment_daily_usage
      set last_seen_at = now()
    where ip_hash = p_ip_hash and usage_date = v_date;
    v_allowed := false;
  end if;

  delete from public.guest_assessment_daily_usage
  where usage_date < v_date - 31;

  return query
  select
    v_allowed,
    v_count,
    greatest(3 - v_count, 0),
    ((v_date + 1)::timestamp at time zone 'UTC');
end;
$$;

revoke all on function public.consume_guest_assessment(text) from public, anon, authenticated;
grant execute on function public.consume_guest_assessment(text) to service_role;
