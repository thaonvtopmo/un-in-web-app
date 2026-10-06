import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mã phiên bản đang chạy trên máy chủ. Trình duyệt hỏi định kỳ để biết app đã có bản mới chưa. */
export function GET() {
  return NextResponse.json({ v: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}
