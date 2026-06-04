-- 업로드된 광고 데이터 초기화 (예산/설정은 유지)
truncate table public.ad_metrics restart identity cascade;
truncate table public.uploads restart identity cascade;
