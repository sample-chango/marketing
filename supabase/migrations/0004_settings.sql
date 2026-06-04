-- 앱 전역 설정 (key/value). 일 예산 등 단일 값 저장용
create table if not exists public.settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "read_settings" on public.settings;
create policy "read_settings" on public.settings for select using (true);

-- 기본 일 예산 40,000원
insert into public.settings (key, value)
values ('daily_budget', '40000')
on conflict (key) do nothing;
