import { NextResponse } from "next/server";
import { adminClient, sendToFamily } from "@/lib/push-server";

export const runtime = "nodejs";

/** Nhắc bố mẹ mỗi ngày: còn việc chờ gật đầu hoặc lời ngoéo tay chưa giữ. Vercel Cron gọi kèm CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = adminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("family_id");
  const families = [...new Set((subs ?? []).map((s) => s.family_id as string))];
  let notified = 0;
  for (const fid of families) {
    const [{ count: pending }, { count: promised }] = await Promise.all([
      admin.from("submissions").select("id", { count: "exact", head: true }).eq("family_id", fid).eq("status", "pending"),
      admin.from("redemptions").select("id", { count: "exact", head: true }).eq("family_id", fid).eq("status", "promised"),
    ]);
    const parts: string[] = [];
    if (pending) parts.push(`${pending} việc chờ gật đầu`);
    if (promised) parts.push(`${promised} lời ngoéo tay chưa giữ`);
    if (!parts.length) continue;
    notified += await sendToFamily(admin, fid, { title: "Nhắc nhẹ từ Ủn", body: `Còn ${parts.join(" và ")}.`, tag: "reminder", url: "/" });
  }
  return NextResponse.json({ families: families.length, notified });
}
