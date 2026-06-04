import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseNaverReport, dateFromFileName } from "@/lib/parse/naver-report";
import { isCategorySlug } from "@/lib/categories";

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
  const category = String(form.get("category") ?? "");
  const fallbackDateRaw = String(form.get("reportDate") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  if (!isCategorySlug(category)) {
    return NextResponse.json(
      { error: `알 수 없는 카테고리: ${category}` },
      { status: 400 },
    );
  }

  // 파싱
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

  // 날짜 폴백: 사용자가 지정한 기준일 > 파일명에서 추출한 날짜
  const fallbackDate =
    (/^\d{4}-\d{2}-\d{2}$/.test(fallbackDateRaw) ? fallbackDateRaw : null) ??
    dateFromFileName(file.name);

  const records = parsed.rows.map((r) => ({
    report_date: r.reportDate ?? fallbackDate,
    category,
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

  const missingDate = records.filter((r) => !r.report_date);
  if (missingDate.length > 0) {
    return NextResponse.json(
      {
        error:
          "보고서에 일자 컬럼이 없습니다. 업로드 폼에서 '기준일자'를 선택해 주세요.",
        detectedColumns: parsed.detectedColumns,
      },
      { status: 422 },
    );
  }

  const supabase = createAdminClient();
  const dates = [...new Set(records.map((r) => r.report_date as string))];

  // 재업로드 멱등: 같은 카테고리 + 동일 일자 기존 데이터 제거 후 재삽입
  const { error: delErr } = await supabase
    .from("ad_metrics")
    .delete()
    .eq("category", category)
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
      category,
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
    detectedColumns: parsed.detectedColumns,
    warnings: parsed.warnings,
  });
}
