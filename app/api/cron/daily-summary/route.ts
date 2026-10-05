import { NextResponse } from "next/server";
import { today } from "@/lib/data";
import { digestText, type DaySummary } from "@/lib/review";
import { adminClient, sendToFamily } from "@/lib/push-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 21:00 mỗi tối (giờ Việt Nam): lưu tổng kết ngày vào lịch sử rồi báo cho bố mẹ
 * ai làm được gì, ai nhận sticker, việc nào cần cải thiện. Vercel Cron gọi kèm CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = adminClient();
  const saved = await admin.rpc("finalize_all", { p_back: 2 });
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });

  const { data: subs } = await admin.from("push_subscriptions").select("family_id");
  const families = [...new Set((subs ?? []).map((s) => s.family_id as string))];
  const day = today();
  let notified = 0;
  for (const fid of families) {
    const [{ data: members }, { data: rows }] = await Promise.all([
      admin.from("members").select("id, name, role").eq("family_id", fid),
      admin.from("day_summaries").select("member_id, planned, done, coins, stickers, done_titles, missed").eq("family_id", fid).eq("day", day),
    ]);
    const names = new Map((members ?? []).map((m) => [m.id as string, m.name as string]));
    const kids = new Set((members ?? []).filter((m) => m.role === "kid").map((m) => m.id as string));
    const summaries: DaySummary[] = (rows ?? []).map((r) => ({
      member: r.member_id, day, planned: r.planned, done: r.done, coins: r.coins,
      stickers: r.stickers ?? [], doneTitles: r.done_titles ?? [], missed: r.missed ?? [],
    }));
    const msg = digestText(summaries, (id) => names.get(id) ?? "Bé", kids);
    notified += await sendToFamily(admin, fid, { ...msg, tag: "digest", url: "/" });
  }
  return NextResponse.json({ families: saved.data, notified });
}
