create table if not exists public.financial_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'GBP' check (char_length(currency) = 3),
  income_amount numeric(14,2) check (income_amount is null or income_amount >= 0),
  income_period text not null default 'monthly' check (income_period in ('monthly','annual')),
  essential_outgoings_monthly numeric(14,2) check (essential_outgoings_monthly is null or essential_outgoings_monthly >= 0),
  debt_commitments_monthly numeric(14,2) check (debt_commitments_monthly is null or debt_commitments_monthly >= 0),
  savings_target_monthly numeric(14,2) check (savings_target_monthly is null or savings_target_monthly >= 0),
  updated_at timestamptz not null default now()
);

alter table public.financial_profiles enable row level security;
grant select, insert, update, delete on public.financial_profiles to authenticated;
revoke all on public.financial_profiles from anon;

create policy "financial_profiles_select_own" on public.financial_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "financial_profiles_insert_own" on public.financial_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "financial_profiles_update_own" on public.financial_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "financial_profiles_delete_own" on public.financial_profiles for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists financial_profiles_updated_idx on public.financial_profiles(updated_at desc);
