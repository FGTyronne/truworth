alter table public.subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists trial_notice_acknowledged_at timestamptz;

comment on column public.subscriptions.trial_started_at is 'First TruWorth+ trial start time. Used to enforce one trial per account.';
comment on column public.subscriptions.trial_end is 'Stripe trial end time when the subscription is trialing.';
comment on column public.subscriptions.trial_notice_acknowledged_at is 'When the user reviewed the final-day in-app trial billing notice.';
