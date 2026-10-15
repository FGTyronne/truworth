create extension if not exists pgcrypto;

create table if not exists public.partner_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_name text not null,
  work_email text not null,
  company_name text not null,
  company_website text,
  enquiry_type text not null check (enquiry_type in ('advertising','member_benefit','affiliate','distribution','research','other')),
  message text not null,
  status text not null default 'new' check (status in ('new','in_review','qualified','declined','closed')),
  privacy_acknowledged boolean not null default false,
  source_page text not null default 'partner-with-truworth',
  ip_hash text,
  user_agent_family text,
  metadata jsonb not null default '{}'::jsonb,
  constraint partner_enquiries_email_length check (char_length(work_email) between 5 and 254),
  constraint partner_enquiries_name_length check (char_length(contact_name) between 2 and 120),
  constraint partner_enquiries_company_length check (char_length(company_name) between 2 and 180),
  constraint partner_enquiries_message_length check (char_length(message) between 20 and 4000),
  constraint partner_enquiries_ip_hash check (ip_hash is null or char_length(ip_hash) = 64)
);

create index if not exists partner_enquiries_created_at_idx on public.partner_enquiries (created_at desc);
create index if not exists partner_enquiries_status_created_idx on public.partner_enquiries (status, created_at desc);
create index if not exists partner_enquiries_ip_created_idx on public.partner_enquiries (ip_hash, created_at desc) where ip_hash is not null;
alter table public.partner_enquiries enable row level security;
revoke all on table public.partner_enquiries from anon, authenticated;
grant select, insert, update, delete on table public.partner_enquiries to service_role;

create table if not exists public.partner_relationships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  website text,
  status text not null default 'prospect' check (status in ('prospect','active','paused','ended')),
  relationship_types text[] not null default '{}',
  geographies text[] not null default '{}',
  disclosure_label text,
  sponsored boolean not null default false,
  affiliate boolean not null default false,
  internal_notes text,
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists partner_relationships_name_lower_idx on public.partner_relationships ((lower(name)));
alter table public.partner_relationships enable row level security;
revoke all on table public.partner_relationships from anon, authenticated;
grant select, insert, update, delete on table public.partner_relationships to service_role;

create table if not exists public.member_benefits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  partner_id uuid not null references public.partner_relationships(id) on delete restrict,
  title text not null,
  description text not null,
  category text not null,
  benefit_type text not null,
  member_tier text not null default 'plus' check (member_tier in ('free','plus')),
  status text not null default 'draft' check (status in ('draft','active','paused','expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  geographies text[] not null default '{}',
  promo_code text,
  destination_url text,
  terms_url text,
  sponsored boolean not null default false,
  affiliate boolean not null default false,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  constraint member_benefits_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists member_benefits_status_priority_idx on public.member_benefits (status, priority, starts_at);
create index if not exists member_benefits_partner_idx on public.member_benefits (partner_id);
alter table public.member_benefits enable row level security;
revoke all on table public.member_benefits from anon, authenticated;
grant select, insert, update, delete on table public.member_benefits to service_role;

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  partner_id uuid references public.partner_relationships(id) on delete restrict,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  campaign_type text not null check (campaign_type in ('house','direct','affiliate','network')),
  disclosure text,
  headline text not null,
  body text not null,
  cta text not null,
  destination_url text not null,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  geographies text[] not null default '{}',
  placements text[] not null default '{}',
  free_only boolean not null default true,
  affiliate boolean not null default false,
  sponsored boolean not null default false,
  category text,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  constraint ad_campaign_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists ad_campaigns_delivery_idx on public.ad_campaigns (status, priority, starts_at, ends_at);
alter table public.ad_campaigns enable row level security;
revoke all on table public.ad_campaigns from anon, authenticated;
grant select, insert, update, delete on table public.ad_campaigns to service_role;

create table if not exists public.ad_events (
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  placement text not null,
  event_type text not null check (event_type in ('impression','click')),
  visitor_hash text,
  session_hash text,
  metadata jsonb not null default '{}'::jsonb,
  constraint ad_events_visitor_hash check (visitor_hash is null or char_length(visitor_hash) = 64),
  constraint ad_events_session_hash check (session_hash is null or char_length(session_hash) = 64)
);
create index if not exists ad_events_campaign_created_idx on public.ad_events (campaign_id, created_at desc);
create index if not exists ad_events_type_created_idx on public.ad_events (event_type, created_at desc);
alter table public.ad_events enable row level security;
revoke all on table public.ad_events from anon, authenticated;
grant select, insert, update, delete on table public.ad_events to service_role;
