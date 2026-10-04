import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Nhận báo lỗi từ trình duyệt (chỉ thông điệp lỗi và loại máy, không có dữ liệu gia đình) và ghi vào nhật ký Vercel. */
export async function POST(req: Request) {
  const raw = (await req.text()).slice(0, 2000);
  try {
    const j = JSON.parse(raw) as { m?: string; s?: string; p?: string; ua?: string };
    console.error("[client-error]", JSON.stringify({ m: String(j.m ?? "").slice(0, 300), s: String(j.s ?? "").slice(0, 600), p: String(j.p ?? "").slice(0, 100), ua: String(j.ua ?? "").slice(0, 200) }));
  } catch {
    /* bỏ qua nội dung không hợp lệ */
  }
  return new NextResponse(null, { status: 204 });
}
