import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { adminClient } from "@/lib/push-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const VOICES = { f: "vi-VN-HoaiMyNeural", m: "vi-VN-NamMinhNeural" } as const;
const hits = new Map<string, number[]>(); // chống gọi dồn dập: mỗi gia đình tối đa 12 lần / phút

/**
 * Đọc lời khen thành giọng tiếng Việt (file mp3) để mọi điện thoại đều nghe được, không cần cài giọng đọc.
 * Người gọi phải đăng nhập. Có thể gửi id lời khen (lấy chữ từ cơ sở dữ liệu) hoặc đoạn chữ tối đa 400 ký tự (để nghe thử).
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = adminClient();
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: fam } = await admin.from("families").select("id").eq("owner_user_id", auth.user.id).maybeSingle();
  if (!fam) return NextResponse.json({ error: "no_family" }, { status: 404 });

  const now = Date.now();
  const recent = (hits.get(fam.id) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 12) return NextResponse.json({ error: "too_many" }, { status: 429 });
  hits.set(fam.id, [...recent, now]);

  const body = (await req.json().catch(() => ({}))) as { praise?: string; text?: string; voice?: string };
  let text = "";
  let voice: "f" | "m" = body.voice === "m" ? "m" : "f";
  if (body.praise) {
    const { data: p } = await admin.from("praises").select("body, voice").eq("id", body.praise).eq("family_id", fam.id).maybeSingle();
    if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
    text = p.body as string;
    voice = p.voice === "m" ? "m" : "f";
  } else {
    text = String(body.text ?? "");
  }
  text = text.replace(/\s+/g, " ").trim().slice(0, 400);
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICES[voice], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 20_000);
      audioStream.on("data", (c: Buffer) => chunks.push(c));
      audioStream.on("close", () => { clearTimeout(timer); resolve(); });
      audioStream.on("error", (e: Error) => { clearTimeout(timer); reject(e); });
    });
    const audio = Buffer.concat(chunks);
    if (audio.length < 500) throw new Error("empty_audio");
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "tts_failed" }, { status: 502 });
  }
}
