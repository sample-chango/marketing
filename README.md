# 마케팅 애널라이저

네이버 검색광고 리포트 파일을 업로드해 종합 지표와 카테고리별 마케팅 퍼널을 확인하는 Next.js 대시보드입니다.

## 주요 화면

| 경로 | 설명 |
| --- | --- |
| `/` | 종합 대시보드 |
| `/category/[slug]` | 카테고리별 마케팅 퍼널 |
| `/upload` | 리포트 파일 업로드 |
| `/login` | 로그인 |
| `/signup` | 가입 신청 |
| `/pending` | 승인 대기 안내 |
| `/admin/signups` | 관리자 가입 승인 |

## 시작하기

`.env.example`을 `.env.local`로 복사한 뒤 Supabase 값을 채웁니다.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Supabase SQL Editor에서 `supabase/migrations/0001_init.sql`을 실행한 뒤 앱을 사용합니다.

## 가입 신청과 승인

공개 회원가입은 바로 사이트 이용 권한을 주지 않습니다.

1. 사용자가 `/signup`에서 이메일과 비밀번호로 가입 신청합니다.
2. 계정은 Supabase Auth에 `approval_status=pending` 상태로 생성됩니다.
3. 관리자가 `/admin/signups`에서 신청자를 승인하거나 거절합니다.
4. 승인된 사용자는 `/login`에서 로그인 후 사이트를 사용할 수 있습니다.
5. 승인 전 사용자가 로그인하면 `/pending`에 머무릅니다.

관리자는 둘 중 하나로 지정할 수 있습니다.

- Supabase Auth 사용자 `app_metadata.role`을 `admin`으로 설정
- Vercel 환경변수 `ADMIN_EMAILS`에 관리자 이메일을 쉼표로 구분해 등록

가입 신청 접수를 닫으려면 Vercel Project Settings > Environment Variables에서 `SIGNUP_REQUESTS_ENABLED=false`로 설정하고 Production에 재배포합니다. 미설정 또는 `true`면 신청을 받습니다.

## 배포

Vercel에 연결된 Git 저장소로 푸시하면 자동으로 새 배포가 생성됩니다. 외부인이 접속하려면 Vercel Deployment Protection 또는 Vercel Authentication이 꺼져 있어야 합니다.
