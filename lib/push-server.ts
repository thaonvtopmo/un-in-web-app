import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

/** Công cụ phía máy chủ để gửi thông báo đẩy. Dùng khoá service role nên TUYỆT ĐỐI không import ở phía trình duyệt. */
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Thiếu cấu hình Supabase phía máy chủ");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("Thiếu khoá VAPID");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:thaonv.topmo@gmail.com", pub, priv);
  configured = true;
}

export type PushMessage = { title: string; body: string; tag?: string; url?: string; /** báo thức: rung, giữ thông báo trên màn hình cho tới khi bấm */ alarm?: boolean };

/** Gửi tới mọi thiết bị đã bật thông báo của một gia đình; tự xoá thiết bị đã hết hiệu lực. Trả về số thiết bị gửi được. */
export async function sendToFamily(admin: SupabaseClient, familyId: string, msg: PushMessage): Promise<number> {
  configure();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("family_id", familyId);
  if (!subs?.length) return 0;
  const payload = JSON.stringify(msg);
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id);
    }
  }));
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return sent;
}
