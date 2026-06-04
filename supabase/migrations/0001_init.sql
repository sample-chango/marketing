-- =============================================================
-- 네이버 광고 리포팅 툴 - 초기 스키마
-- =============================================================

-- 업로드 배치 기록 (어떤 파일을, 어떤 카테고리로, 언제 올렸는지)
create table if not exists public.uploads (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  file_name     text not null,
  row_count     integer not null default 0,
  period_start  date,
  period_end    date,
  created_at    timestamptz not null default now()
);

-- 광고 성과 원시 데이터 (네이버 보고서 1행 = 1레코드)
create table if not exists public.ad_metrics (
  id                uuid primary key default gen_random_uuid(),
  upload_id         uuid references public.uploads(id) on delete cascade,
  report_date       date not null,
  category          text not null
                      check (category in
                        ('wallpaper','film','flooring','bestpack','signature')),
  campaign          text,
  ad_group          text,
  keyword           text,
  impressions       bigint        not null default 0,  -- 노출수
  clicks            bigint        not null default 0,  -- 클릭수
  cost              numeric(16,2) not null default 0,  -- 광고비(원)
  conversions       numeric(16,2) not null default 0,  -- 전환수
  conversion_value  numeric(18,2) not null default 0,  -- 전환매출액(원)
  quality_score     smallint
                      check (quality_score between 1 and 10), -- 품질지수
  created_at        timestamptz   not null default now()
);

-- 집계 조회 최적화
create index if not exists idx_ad_metrics_category on public.ad_metrics (category);
create index if not exists idx_ad_metrics_date     on public.ad_metrics (report_date);
create index if not exists idx_ad_metrics_cat_date on public.ad_metrics (category, report_date);

-- 동일 (일자/카테고리/캠페인/광고그룹/키워드) 중복 방지 → 재업로드 시 upsert 가능
create unique index if not exists uq_ad_metrics_row on public.ad_metrics (
  report_date,
  category,
  coalesce(campaign, ''),
  coalesce(ad_group, ''),
  coalesce(keyword, '')
);

-- =============================================================
-- RLS (Row Level Security)
--  - 내부 리포팅 툴: 읽기는 허용, 쓰기는 service_role(서버)만 (RLS 우회)
--  - 인증을 붙이면 아래 정책을 authenticated 기준으로 좁히세요.
-- =============================================================
alter table public.uploads    enable row level security;
alter table public.ad_metrics enable row level security;

drop policy if exists "read_uploads" on public.uploads;
create policy "read_uploads" on public.uploads
  for select using (true);

drop policy if exists "read_ad_metrics" on public.ad_metrics;
create policy "read_ad_metrics" on public.ad_metrics
  for select using (true);
