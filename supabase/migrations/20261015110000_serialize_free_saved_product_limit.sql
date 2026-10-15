create or replace function public.enforce_assessment_limit()
returns trigger
language plpgsql
set search_path = public
as $function$
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
    -- Serialise inserts for the same user so concurrent requests cannot both
    -- observe four saved products and create a sixth Free-plan record.
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

    select count(*) into stored_count
    from public.assessments
    where user_id = new.user_id;

    if stored_count >= 5 then
      raise exception 'Free plan saved product limit reached. Remove a saved product or upgrade to TruWorth+.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;
