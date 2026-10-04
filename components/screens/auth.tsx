"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Pig } from "@/components/Pig";
import { createFamily } from "@/lib/backend";
import { getSupabase } from "@/lib/supabase";

export function Splash({ text = "Ủn đang thức dậy..." }: { text?: string }) {
  return (
    <main className="app" style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div className="bob"><Pig mood="happy" size={110} /></div>
      <div className="muted">{text}</div>
      {/* Hiện bằng CSS sau 10 giây: nếu trang đứng yên (trình duyệt quá cũ, mạng chập chờn) người dùng vẫn có lối ra */}
      <div className="late-help stack" style={{ alignItems: "center", gap: 8, maxWidth: 320 }}>
        <div style={{ fontWeight: 800 }}>Tải lâu hơn bình thường rồi.</div>
        {/* Dùng thẻ a thường để tải lại toàn bộ trang, kể cả khi JavaScript không chạy */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="btn" href="/">Tải lại trang</a>
        <div className="muted">Nếu vẫn đứng yên: kiểm tra mạng, hoặc cập nhật iOS (cần iOS 15.4 trở lên) rồi mở lại.</div>
      </div>
    </main>
  );
}

/** Xoá phiên đăng nhập, bộ nhớ đệm và service worker rồi tải lại: cách chữa khi app đứng yên vì dữ liệu cũ */
export async function resetAndReload() {
  try { await getSupabase().auth.signOut({ scope: "local" }); } catch { /* bỏ qua */ }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k);
    for (const c of document.cookie.split(";")) {
      const name = c.split("=")[0].trim();
      if (name.startsWith("sb-")) {
        const secure = location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${name}=; Max-Age=0; path=/${secure}`;
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${secure}`;
      }
    }
  } catch { /* bỏ qua */ }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
    const keys = await caches?.keys();
    await Promise.all((keys ?? []).map((k) => caches.delete(k)));
  } catch { /* bỏ qua */ }
  location.replace("/");
}

export function Login() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function google() {
    setBusy(true); setErr("");
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setErr("Chưa đăng nhập được, thử lại nhé"); setBusy(false); }
  }

  return (
    <main className="app" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", maxWidth: 420 }}>
      <Pig mood="joy" size={130} className="bob" />
      <h1>Ủn Ỉn Cả Nhà</h1>
      <p className="muted">Cùng con làm việc nhỏ · cùng nhau đi chơi to</p>
      <div className="card stack" style={{ width: "100%", gap: 12, padding: 18 }}>
        <h2>Bố mẹ đăng nhập</h2>
        <p className="muted">Chỉ cần 1 tài khoản Gmail cho cả nhà. Các con không cần Gmail riêng.</p>
        <button className="btn big coin" onClick={google} disabled={busy}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          {busy ? "Đang mở Google..." : "Đăng nhập bằng Google"}
        </button>
        {err && <div style={{ color: "#C2185B", fontWeight: 800, fontSize: 14 }}>{err}</div>}
      </div>
      <p className="muted">
        Khi đăng nhập, bạn đồng ý với <Link href="/terms" style={{ textDecoration: "underline" }}>Điều khoản</Link> và{" "}
        <Link href="/privacy" style={{ textDecoration: "underline" }}>Chính sách quyền riêng tư</Link>.
      </p>
    </main>
  );
}

function NameList({ title, hint, names, onChange, max, addLabel }: {
  title: string; hint: string; names: string[]; onChange: (n: string[]) => void; max: number; addLabel: string;
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div><h3>{title}</h3><div className="muted">{hint}</div></div>
      {names.map((n, i) => (
        <div key={i} className="row">
          <input
            className="field" value={n} maxLength={20} placeholder={`Tên ${i + 1}`} aria-label={`${title} ${i + 1}`}
            onChange={(e) => onChange(names.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {names.length > 1 && (
            <button type="button" className="btn sm" aria-label="Bỏ dòng này" onClick={() => onChange(names.filter((_, j) => j !== i))}>
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      ))}
      {names.length < max && (
        <button type="button" className="btn sm ghost" onClick={() => onChange([...names, ""])}>
          <Icon name="plus" size={16} strokeWidth={3} />{addLabel}
        </button>
      )}
    </div>
  );
}

export function Setup({ email, onDone, onSignOut }: { email: string; onDone: () => void; onSignOut: () => void }) {
  const [familyName, setFamilyName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [parents, setParents] = useState(["Bố", "Mẹ"]);
  const [kids, setKids] = useState([""]);
  const [start, setStart] = useState("19:30");
  const [end, setEnd] = useState("19:45");
  const [minutes, setMinutes] = useState(10);
  const [enforce, setEnforce] = useState(true);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [leaderboard, setLeaderboard] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ps = parents.map((x) => x.trim()).filter(Boolean);
    const ks = kids.map((x) => x.trim()).filter(Boolean);
    if (!ps.length) return setErr("Cần ít nhất 1 người lớn (bố hoặc mẹ)");
    if (!ks.length) return setErr("Cần ít nhất 1 bé. Nhập tên con nhé");
    if (!/^\d{4}$/.test(pin)) return setErr("PIN phải gồm đúng 4 chữ số");
    if (pin !== pin2) return setErr("Hai lần nhập PIN chưa giống nhau");
    if (start >= end) return setErr("Giờ kết thúc phải sau giờ bắt đầu");
    setErr(""); setBusy(true);
    try {
      await createFamily({
        name: familyName, pin, start, end, minutes: Math.min(60, Math.max(1, minutes || 10)), enforce, limitEnabled, leaderboard,
        members: [...ps.map((name) => ({ name, role: "parent" as const })), ...ks.map((name) => ({ name, role: "kid" as const }))],
      });
      onDone();
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "";
      setErr(msg.includes("family_exists") ? "Tài khoản này đã có gia đình rồi" : "Chưa tạo được gia đình, thử lại nhé");
      setBusy(false);
    }
  }

  return (
    <main className="app" style={{ maxWidth: 560 }}>
      <div className="row">
        <Pig mood="happy" size={72} />
        <div className="grow">
          <h1>Lập gia đình trên Ủn Ỉn</h1>
          <div className="muted">Đang đăng nhập: {email}</div>
        </div>
      </div>
      <form className="card stack" style={{ gap: 14, padding: 16 }} onSubmit={submit}>
        <label className="lbl">Tên gia đình (không bắt buộc)
          <input className="field" value={familyName} maxLength={40} placeholder="Ví dụ: Nhà Gấu Bông" onChange={(e) => setFamilyName(e.target.value)} />
        </label>
        <NameList title="Bố mẹ" hint="Người lớn trong nhà. Cần PIN để vào Góc bố mẹ." names={parents} onChange={setParents} max={4} addLabel="Thêm người lớn" />
        <NameList title="Các con" hint="Mỗi bé một tên. Các con không cần Gmail riêng." names={kids} onChange={setKids} max={8} addLabel="Thêm bé" />
        <div className="stack" style={{ gap: 8 }}>
          <div><h3>PIN bố mẹ</h3><div className="muted">4 chữ số. Con nhập đúng PIN này mới vào được Góc bố mẹ.</div></div>
          <div className="grid2">
            <label className="lbl">Nhập PIN<input className="field" type="password" inputMode="numeric" maxLength={4} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>
            <label className="lbl">Nhập lại<input className="field" type="password" inputMode="numeric" maxLength={4} autoComplete="off" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} /></label>
          </div>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div><h3>Giờ Ủn Ỉn</h3><div className="muted">Khung giờ buổi tối cả nhà cùng mở app. Ngoài giờ, con chỉ thấy &quot;Ủn đang ngủ rồi!&quot;.</div></div>
          <div className="grid2">
            <label className="lbl">Mở từ<input className="field" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="lbl">Đến<input className="field" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <label className="lbl check"><input type="checkbox" checked={limitEnabled} onChange={(e) => setLimitEnabled(e.target.checked)} />Giới hạn số phút chơi mỗi ngày (có thể bật sau)</label>
          <label className="lbl">Số phút chơi mỗi ngày của con (khi bật giới hạn)<input className="field" type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
          <label className="lbl check"><input type="checkbox" checked={enforce} onChange={(e) => setEnforce(e.target.checked)} />Chỉ cho con dùng trong giờ Ủn Ỉn</label>
        </div>
        <label className="lbl check" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" checked={leaderboard} onChange={(e) => setLeaderboard(e.target.checked)} />
          <span>Tham gia bảng xếp hạng các nhà. Chỉ hiện tên gia đình và số Ủn trung bình, không hiện tên bé. Đừng dùng họ tên đầy đủ của bé làm tên gia đình. Đổi lại được trong Cài đặt.</span>
        </label>
        {err && <div role="alert" style={{ color: "#C2185B", fontWeight: 800, fontSize: 14 }}>{err}</div>}
        <button className="btn big mint" type="submit" disabled={busy}>{busy ? "Đang tạo..." : "Tạo gia đình"}</button>
        <div className="muted">Có sẵn 6 việc tốt cho con, 4 mục checklist cho bố mẹ, 6 phiếu đi chơi và 1 Hũ Mơ Ước. Chỉnh lại sau trong Góc bố mẹ.</div>
      </form>
      <button className="btn sm ghost" style={{ alignSelf: "center" }} onClick={onSignOut}>Dùng tài khoản Gmail khác</button>
    </main>
  );
}
