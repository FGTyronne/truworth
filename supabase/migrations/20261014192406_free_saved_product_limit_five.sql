create or replace function public.enforce_assessment_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_tier text;
  stored_count integer;
begin
  select tier into current_tier
  from public.subscriptions
  where user_id = new.user_id
    and status in ('active','trialing');

  current_tier := coalesce(current_tier, 'free');

  if current_tier = 'free' then
    select count(*) into stored_count
    from public.assessments
    where user_id = new.user_id;

    if stored_count >= 5 then
      raise exception 'Free plan saved product limit reached. Remove a saved product or upgrade to TruWorth+.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists assessments_enforce_plan_limit on public.assessments;
create trigger assessments_enforce_plan_limit
before insert on public.assessments
for each row execute function public.enforce_assessment_limit();
