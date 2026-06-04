-- 카테고리에 '장판'(jangpan) 추가
alter table public.ad_metrics drop constraint if exists ad_metrics_category_check;
alter table public.ad_metrics add constraint ad_metrics_category_check
  check (category in ('wallpaper','flooring','jangpan','film','bestpack','signature'));
