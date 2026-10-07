import { NextResponse } from "next/server";
import { alarmMessage, type DueAlarm } from "@/lib/alarm-message";
import { adminClient, sendToFamily } from "@/lib/push-server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Báo thức đến giờ: bộ hẹn giờ trong database (pg_cron) gọi đây mỗi khi có báo thức đến giờ hoặc cần nhắc lại.
 * Gửi thông báo đẩy tới các máy của gia đình; tiếng chuông và giọng bố mẹ phát khi mở app trên máy của bé.
 * Bé chưa bấm "Con dậy rồi!" thì cứ 5 phút nhắc lại, tối đa 3 lần. Chỉ nhận lời gọi kèm mã bí mật ALARM_SECRET.
 */
async function handle(req: Request) {
  const secret = process.env.ALARM_SECRET || process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = adminClient();
  const { data, error } = await admin.rpc("claim_due_alarms");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let sent = 0, repeats = 0;
  const rows = (data ?? []) as DueAlarm[];
  for (const a of rows) {
    const m = alarmMessage(a);
    if (a.repeat_no > 0) repeats++;
    sent += await sendToFamily(admin, a.family_id, { ...m, tag: `alarm-${a.id}`, url: "/", alarm: true });
  }
  return NextResponse.json({ due: rows.length, repeats, sent });
}

export const GET = handle;
export const POST = handle;
