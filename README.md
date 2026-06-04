# 네이버 광고 리포팅 툴

네이버 검색광고 보고서를 업로드하여 **종합 지수**와 **카테고리별 마케팅 퍼널**을
시각화하는 리포팅 대시보드입니다.

- **프론트엔드/서버**: Next.js (App Router, TypeScript, Tailwind)
- **데이터베이스**: Supabase (Postgres)
- **데이터 입력**: 네이버 검색광고 보고서(.xlsx / .csv) 업로드 → 파싱 → 저장

## 화면 구성

| 경로 | 설명 |
|------|------|
| `/` | 종합 대시보드 — 전체 노출수·CTR·CPC·CVR·CPA·ROAS·품질지수 + 카테고리별 요약 |
| `/category/[slug]` | 카테고리별 마케팅 퍼널 (인지→획득→활성화→수익) + 세부 항목 |
| `/upload` | 보고서 파일 업로드 |

카테고리: **벽지(wallpaper) · 필름(film) · 마루(flooring) · 베스트팩(bestpack) · 시그니처 매치(signature)**

### 마케팅 퍼널 (AARRR, 유지·추천 단계 제외)

| 단계 | 지표 |
|------|------|
| 인지 (Awareness) | 노출수 |
| 획득 (Acquisition) | CTR, CPC |
| 활성화 (Activation) | CVR, CPA |
| 수익 (Revenue) | ROAS |

## 시작하기

### 1. 환경변수

`.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 프로젝트 > Settings > API
- `SUPABASE_SERVICE_ROLE_KEY`: 업로드 저장(서버 전용). 절대 클라이언트에 노출 금지

### 2. DB 스키마 적용

Supabase 대시보드 > SQL Editor에서 `supabase/migrations/0001_init.sql`을 실행합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 접속 → `/upload`에서 네이버 보고서를 업로드하면 지표가 채워집니다.

## 데이터 파싱 규칙

`src/lib/parse/naver-report.ts`가 보고서 헤더를 유연하게 매칭합니다.
비율 컬럼(CTR/CVR/ROAS 등)은 무시하고 **원시값**(노출·클릭·광고비·전환수·전환매출·품질지수)만
저장하며, 파생 지표는 `src/lib/metrics.ts`에서 다시 계산합니다.

> 보고서 양식(맞춤 보고서의 컬럼 구성)에 따라 매칭 규칙 조정이 필요할 수 있습니다.
> 업로드 결과의 "인식된 컬럼 보기"로 매칭 상태를 확인할 수 있습니다.

## 폴더 구조

```
src/
  app/
    page.tsx                  종합 대시보드
    category/[slug]/page.tsx  카테고리 퍼널
    upload/page.tsx           업로드 폼
    api/upload/route.ts       업로드 처리(파싱+저장)
  components/                 Nav, MetricCard, FunnelView
  lib/
    categories.ts             카테고리 정의
    metrics.ts                지표 계산
    funnel.ts                 퍼널 단계 정의
    data.ts                   Supabase 집계 조회
    parse/naver-report.ts     보고서 파서
    supabase/                 client / server / admin
supabase/migrations/          DB 스키마
```
