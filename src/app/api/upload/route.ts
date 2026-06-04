import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseNaverReport, dateFromFileName } from "@/lib/parse/naver-report";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // 환경변수 확인
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase 환경변수(SERVICE_ROLE_KEY)가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const fallbackDateRaw = String(form.get("reportDate") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  // 파싱 (행별 카테고리 자동 분류 포함)
  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseNaverReport(buffer, file.name);
  } catch (e) {
    return NextResponse.json(
      { error: "파일 파싱 실패: " + (e as Error).message },
      { status: 422 },
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error: "유효한 데이터 행을 찾지 못했습니다.",
        detectedColumns: parsed.detectedColumns,
        warnings: parsed.warnings,
      },
      { status: 422 },
    );
  }

  // 날짜: 파일에 명시된 일자 > 파일명에서 추출 > 사용자가 지정한 기준일
  const fallbackDate =
    dateFromFileName(file.name) ??
    (/^\d{4}-\d{2}-\d{2}$/.test(fallbackDateRaw) ? fallbackDateRaw : null);

  // 분류된 행만 저장 (미분류는 건너뜀 → 응답에 목록 반환)
  const classified = parsed.rows.filter((r) => r.category);
  const records = classified.map((r) => ({
    report_date: r.reportDate ?? fallbackDate,
    category: r.category,
    campaign: r.campaign,
    ad_group: r.adGroup,
    keyword: r.keyword,
    impressions: r.impressions,
    clicks: r.clicks,
    cost: r.cost,
    conversions: r.conversions,
    conversion_value: r.conversionValue,
    quality_score: r.qualityScore,
  }));

  if (records.length === 0) {
    return NextResponse.json(
      {
        error:
          "분류된 상품이 없습니다. 소재명/카테고리 경로에 벽지·마루·장판·필름·베스트팩·시그니처 키워드가 있는지 확인하세요.",
        unclassified: parsed.unclassified.slice(0, 20),
      },
      { status: 422 },
    );
  }

  const missingDate = records.filter((r) => !r.report_date);
  if (missingDate.length > 0) {
    return NextResponse.json(
      {
        error:
          "파일/파일명에서 날짜를 찾지 못했습니다. 업로드 폼에서 '기준일자'를 선택해 주세요.",
        detectedColumns: parsed.detectedColumns,
      },
      { status: 422 },
    );
  }

  const supabase = createAdminClient();
  const dates = [...new Set(records.map((r) => r.report_date as string))];

  // 재업로드 멱등: 동일 일자(전체 카테고리) 기존 데이터 제거 후 재삽입
  const { error: delErr } = await supabase
    .from("ad_metrics")
    .delete()
    .in("report_date", dates);
  if (delErr) {
    return NextResponse.json(
      { error: "기존 데이터 정리 실패: " + delErr.message },
      { status: 500 },
    );
  }

  // 업로드 배치 기록
  const sortedDates = [...dates].sort();
  const { data: uploadRow, error: upErr } = await supabase
    .from("uploads")
    .insert({
      category: "all",
      file_name: file.name,
      row_count: records.length,
      period_start: sortedDates[0],
      period_end: sortedDates[sortedDates.length - 1],
    })
    .select("id")
    .single();
  if (upErr) {
    return NextResponse.json(
      { error: "업로드 기록 실패: " + upErr.message },
      { status: 500 },
    );
  }

  const withUpload = records.map((r) => ({ ...r, upload_id: uploadRow.id }));
  const { error: insErr } = await supabase.from("ad_metrics").insert(withUpload);
  if (insErr) {
    return NextResponse.json(
      { error: "데이터 저장 실패: " + insErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: records.length,
    dates: sortedDates,
    categoryCounts: parsed.categoryCounts,
    unclassifiedCount: parsed.unclassified.length,
    unclassified: parsed.unclassified.slice(0, 20),
    detectedColumns: parsed.detectedColumns,
    warnings: parsed.warnings,
  });
}
