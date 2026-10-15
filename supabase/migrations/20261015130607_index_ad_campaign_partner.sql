create index if not exists ad_campaigns_partner_idx on public.ad_campaigns (partner_id) where partner_id is not null;
