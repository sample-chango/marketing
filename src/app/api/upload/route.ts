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

  // 기간 결정: 폼의 기간(start~end) > 단일 일자(reportDate) > 파일명 날짜
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const psRaw = String(form.get("periodStart") ?? "");
  const peRaw = String(form.get("periodEnd") ?? "");
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  if (isDate(psRaw) && isDate(peRaw)) {
    periodStart = psRaw <= peRaw ? psRaw : peRaw;
    periodEnd = psRaw <= peRaw ? peRaw : psRaw;
  } else {
    const single = isDate(fallbackDateRaw)
      ? fallbackDateRaw
      : dateFromFileName(file.name);
    if (single) {
      periodStart = single;
      periodEnd = single;
    }
  }

  if (!periodStart || !periodEnd) {
    return NextResponse.json(
      {
        error:
          "기간(또는 일자)을 확인할 수 없습니다. 파일명에 날짜가 없으면 업로드 폼에서 기간/일자를 지정하세요.",
        detectedColumns: parsed.detectedColumns,
      },
      { status: 422 },
    );
  }

  // 분류된 행만 저장 (미분류는 건너뜀 → 응답에 목록 반환)
  const classified = parsed.rows.filter((r) => r.category);
  const records = classified.map((r) => ({
    report_date: periodEnd,
    period_start: periodStart,
    period_end: periodEnd,
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

  const supabase = createAdminClient();

  // 재업로드 멱등: 동일 기간 기존 데이터 제거 후 재삽입
  const { error: delErr } = await supabase
    .from("ad_metrics")
    .delete()
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);
  if (delErr) {
    return NextResponse.json(
      { error: "기존 데이터 정리 실패: " + delErr.message },
      { status: 500 },
    );
  }

  // 업로드 배치 기록
  const { data: uploadRow, error: upErr } = await supabase
    .from("uploads")
    .insert({
      category: "all",
      file_name: file.name,
      row_count: records.length,
      period_start: periodStart,
      period_end: periodEnd,
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
    period: { start: periodStart, end: periodEnd },
    categoryCounts: parsed.categoryCounts,
    unclassifiedCount: parsed.unclassified.length,
    unclassified: parsed.unclassified.slice(0, 20),
    detectedColumns: parsed.detectedColumns,
    warnings: parsed.warnings,
  });
}
