import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303: POST → GET 으로 전환하며 로그인 페이지로 리다이렉트
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
