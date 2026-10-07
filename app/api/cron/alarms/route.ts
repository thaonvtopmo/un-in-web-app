import { NextResponse } from "next/server";
import { adminClient, sendToFamily } from "@/lib/push-server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Báo thức đến giờ: bộ hẹn giờ trong database (pg_cron) gọi đây mỗi khi có báo thức đến giờ.
 * Gửi thông báo đẩy tới các máy của gia đình ("Dậy thôi Bin ơi!"); tiếng chuông và giọng bố mẹ phát khi mở app trên máy của bé.
 * Chỉ nhận lời gọi kèm mã bí mật ALARM_SECRET.
 */
async function handle(req: Request) {
  const secret = process.env.ALARM_SECRET || process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = adminClient();
  const { data, error } = await admin.rpc("claim_due_alarms");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let sent = 0;
  const rows = (data ?? []) as { id: string; family_id: string; title: string; at_text: string; kid_names: string[] }[];
  for (const a of rows) {
    const who = a.kid_names.length ? a.kid_names.join(", ") : "cả nhà";
    sent += await sendToFamily(admin, a.family_id, {
      title: `⏰ ${a.title} (${a.at_text})`, body: `Dậy thôi ${who} ơi! Mở Ủn Ỉn để nghe lời nhắc.`, tag: `alarm-${a.id}`, url: "/", alarm: true,
    });
  }
  return NextResponse.json({ due: rows.length, sent });
}

export const GET = handle;
export const POST = handle;
