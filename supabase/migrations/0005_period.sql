-- 보고서 기간(start~end) 지원. 단일 일자는 start=end.
alter table public.ad_metrics
  add column if not exists period_start date,
  add column if not exists period_end   date;

-- 기존 데이터 백필: report_date를 단일 일자로 간주
update public.ad_metrics
  set period_start = coalesce(period_start, report_date),
      period_end   = coalesce(period_end, report_date)
  where period_start is null or period_end is null;

create index if not exists idx_ad_metrics_period
  on public.ad_metrics (period_end, period_start);
