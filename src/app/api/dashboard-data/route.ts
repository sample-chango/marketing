import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json(data);
}