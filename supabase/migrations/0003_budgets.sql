-- 카테고리별 월 예산
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  category    text not null
                check (category in
                  ('wallpaper','flooring','jangpan','film','bestpack','signature')),
  month       text not null check (month ~ '^\d{4}-\d{2}$'), -- 'YYYY-MM'
  amount      numeric(16,2) not null default 0,
  updated_at  timestamptz not null default now(),
  unique (category, month)
);

alter table public.budgets enable row level security;

drop policy if exists "read_budgets" on public.budgets;
create policy "read_budgets" on public.budgets for select using (true);
