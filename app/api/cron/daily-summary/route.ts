import { NextResponse } from "next/server";
import { today } from "@/lib/data";
import { digestText, type DaySummary } from "@/lib/review";
import { adminClient, sendToFamily } from "@/lib/push-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Dọn file ghi âm mồ côi: lời khen hoặc báo thức đã bị xoá, lời khen bị đẩy khỏi 50 lời gần nhất. Chỉ xoá file cũ hơn 1 giờ để không đụng lần tải lên đang diễn ra. */
async function cleanOrphanAudio(admin: ReturnType<typeof adminClient>): Promise<number> {
  const { data: fams } = await admin.from("families").select("id");
  let removed = 0;
  for (const f of fams ?? []) {
    const { data: files } = await admin.storage.from("praise-audio").list(f.id as string, { limit: 500 });
    if (!files?.length) continue;
    const { data: used } = await admin.from("praises").select("audio_path").eq("family_id", f.id).not("audio_path", "is", null);
    const { data: usedAlarm } = await admin.from("alarms").select("audio_path").eq("family_id", f.id).not("audio_path", "is", null);
    const keep = new Set([...(used ?? []), ...(usedAlarm ?? [])].map((r) => r.audio_path as string));
    const stale = files.filter((o) => !keep.has(`${f.id}/${o.name}`) && Date.now() - new Date(o.created_at ?? Date.now()).getTime() > 3600_000).map((o) => `${f.id}/${o.name}`);
    if (stale.length) { await admin.storage.from("praise-audio").remove(stale); removed += stale.length; }
  }
  return removed;
}

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
  await admin.rpc("admin_snapshot"); // số liệu cho trang quản trị; lỗi ở đây không ảnh hưởng việc báo cho bố mẹ

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
  const cleaned = await cleanOrphanAudio(admin).catch(() => 0);
  return NextResponse.json({ families: saved.data, notified, cleaned });
}
