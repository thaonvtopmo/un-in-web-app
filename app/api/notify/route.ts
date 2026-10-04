import { NextResponse } from "next/server";
import { adminClient, sendToFamily } from "@/lib/push-server";

export const runtime = "nodejs";

const lastSent = new Map<string, number>(); // chống gửi dồn dập (mỗi gia đình, mỗi loại, tối đa 1 lần / 4 giây)

/**
 * Con làm xong việc / đổi phiếu thì máy của con gọi API này để báo cho các thiết bị của bố mẹ.
 * Người gọi phải đăng nhập (Bearer token). Nội dung thông báo được dựng từ cơ sở dữ liệu,
 * không dùng bất kỳ chữ nào do trình duyệt gửi lên.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = adminClient();
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: fam } = await admin.from("families").select("id").eq("owner_user_id", auth.user.id).maybeSingle();
  if (!fam) return NextResponse.json({ error: "no_family" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind === "pending" || body.kind === "redeem" || body.kind === "test" ? body.kind : null;
  if (!kind) return NextResponse.json({ error: "bad_kind" }, { status: 400 });

  const key = `${fam.id}:${kind}`;
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < 4000) return NextResponse.json({ sent: 0, throttled: true });
  lastSent.set(key, now);

  if (kind === "test") {
    const sent = await sendToFamily(admin, fam.id, { title: "Ủn Ỉn Cả Nhà", body: "Thông báo hoạt động rồi nè!", tag: "test" });
    return NextResponse.json({ sent });
  }

  if (kind === "pending") {
    const { data: rows } = await admin.from("submissions").select("member_id, task_id, submitted_at").eq("family_id", fam.id).eq("status", "pending").order("submitted_at", { ascending: false });
    if (!rows?.length) return NextResponse.json({ sent: 0 });
    const [{ data: m }, { data: t }] = await Promise.all([
      admin.from("members").select("name").eq("id", rows[0].member_id).maybeSingle(),
      admin.from("tasks").select("title").eq("id", rows[0].task_id).maybeSingle(),
    ]);
    const more = rows.length > 1 ? ` (và ${rows.length - 1} việc nữa)` : "";
    const sent = await sendToFamily(admin, fam.id, {
      title: "Chờ gật đầu", body: `${m?.name ?? "Con"} vừa làm xong "${t?.title ?? "một việc tốt"}"${more}`, tag: "pending", url: "/",
    });
    return NextResponse.json({ sent });
  }

  const { data: reds } = await admin.from("redemptions").select("member_id, reward_id").eq("family_id", fam.id).eq("status", "promised").order("created_at", { ascending: false }).limit(1);
  if (!reds?.length) return NextResponse.json({ sent: 0 });
  const [{ data: m }, { data: r }] = await Promise.all([
    admin.from("members").select("name").eq("id", reds[0].member_id).maybeSingle(),
    admin.from("rewards").select("title").eq("id", reds[0].reward_id).maybeSingle(),
  ]);
  const sent = await sendToFamily(admin, fam.id, {
    title: "Con vừa đổi phiếu", body: `${m?.name ?? "Con"} đổi phiếu "${r?.title ?? "đi chơi"}". Nhớ giữ lời nhé!`, tag: "redeem", url: "/",
  });
  return NextResponse.json({ sent });
}
