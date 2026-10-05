"use client";

import { useEffect } from "react";
import { Coin } from "@/components/Coin";
import { Icon } from "@/components/Icon";
import { Pig } from "@/components/Pig";
import { DEMO_PIN, mem, taskOf } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { Member } from "@/lib/types";

export function Avatar({ m, size = 44, fs = 18 }: { m: Member; size?: number; fs?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: m.color, fontSize: m.avatar ? Math.round(size * 0.56) : fs, lineHeight: 1 }}>
      {m.avatar ?? m.initial}
    </div>
  );
}

/** Trạng thái trống thân thiện: con heo, một câu ngắn, và (nếu có) một nút để bắt đầu */
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="card empty-state">
      <Pig mood="sleep" size={64} />
      <div className="display" style={{ fontSize: 16 }}>{title}</div>
      {hint && <div className="muted" style={{ maxWidth: 320 }}>{hint}</div>}
      {action && <button className="btn sm mint" onClick={action.onClick}><Icon name="plus" size={16} strokeWidth={3} />{action.label}</button>}
    </div>
  );
}

export function Profiles() {
  const { S, A, demo } = useApp();
  const familyName = S.familyName;
  return (
    <main className="app" style={{ justifyContent: "center" }}>
      <div className="row" style={{ justifyContent: "center" }}>
        <Coin size={28} />
        <span className="display" style={{ fontSize: 26 }}>Ủn Ỉn Cả Nhà</span>
      </div>
      <div className="muted" style={{ textAlign: "center", marginTop: -8 }}>{familyName ? `Nhà ${familyName}` : "Cùng con làm việc nhỏ · cùng nhau đi chơi to"}</div>
      <div className="stack" style={{ alignItems: "center", gap: 4, textAlign: "center" }}>
        <Pig mood="happy" size={104} />
        <h1>Ai vào chơi với Ủn nè?</h1>
        <div className="muted">Bấm vào hình của mình nhé</div>
      </div>
      <div className="grid2 profiles">
        {S.members.map((m) => (
          <button
            key={m.id}
            className="card"
            onClick={() => A.pick(m.id)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px", boxShadow: "0 4px 0 var(--ink)" }}
          >
            <Avatar m={m} size={68} fs={m.role === "parent" ? 26 : 30} />
            <span className="display" style={{ fontSize: 19 }}>{m.name}</span>
            {m.role === "parent" ? (
              <span className="pill" style={{ background: m.soft }}><Icon name="lock" size={13} strokeWidth={3} />Nhập PIN</span>
            ) : (
              <span className="pill" style={{ background: m.soft }}>{m.label}</span>
            )}
          </button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "center", background: "var(--ink)", color: "var(--bg)", borderRadius: 999, padding: "10px 16px", fontSize: 14 }}>
        <Icon name="clock" size={18} strokeWidth={2.8} color="#FFC93C" />
        Giờ Ủn Ỉn: {S.settings.start} – {S.settings.end}
      </div>
      {demo && <p className="muted" style={{ textAlign: "center" }}>Bản dùng thử · PIN bố mẹ: {DEMO_PIN}</p>}
    </main>
  );
}

export function PinDialog() {
  const { S, U, A } = useApp();
  const m = mem(S, U.pinFor!);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) A.key(e.key);
      else if (e.key === "Backspace") A.del();
      else if (e.key === "Escape") A.pinClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [A]);

  return (
    <div className="overlay" style={{ background: "rgba(59,42,26,.55)" }} role="dialog" aria-modal="true" aria-label="Nhập PIN">
      <div className={`card stack ${U.pinErr ? "shake" : ""}`} style={{ width: "100%", maxWidth: 320, alignItems: "center", gap: 12, padding: 20 }}>
        <Avatar m={m} size={56} fs={22} />
        <h2>{m.name} nhập PIN</h2>
        <div className="dots">
          {[0, 1, 2, 3].map((i) => <i key={i} className={i < U.pin.length ? "on" : ""} />)}
        </div>
        {U.pinErr && <div style={{ color: "#C2185B", fontWeight: 800, fontSize: 14 }}>Sai PIN rồi, thử lại nhé</div>}
        <div className="keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} className="btn" onClick={() => A.key(String(n))}>{n}</button>
          ))}
          <button className="btn ghost" style={{ fontSize: 14 }} onClick={A.pinClose}>Huỷ</button>
          <button className="btn" onClick={() => A.key("0")}>0</button>
          <button className="btn" onClick={A.del} aria-label="Xoá số"><Icon name="back" size={20} strokeWidth={3} /></button>
        </div>
      </div>
    </div>
  );
}

export function SleepScreen({ timeout }: { timeout: boolean }) {
  const { S, A } = useApp();
  return (
    <main className="app" style={{ alignItems: "center", textAlign: "center", justifyContent: "center", paddingBottom: 40 }}>
      <div className="bob"><Pig mood="sleep" size={140} /></div>
      <div className="display" style={{ fontSize: 24, color: "#FFE08A" }}>Z z z</div>
      <h1 style={{ color: "var(--bg)" }}>{timeout ? "Hết giờ chơi rồi!" : "Ủn đang ngủ rồi!"}</h1>
      <p style={{ fontSize: 16, maxWidth: 320 }}>
        {timeout ? "Hôm nay vậy là đủ rồi. Mai mình gặp lại nhé!" : "Đi chơi với bố mẹ đi, tối gặp lại nhé!"}
      </p>
      <div className="pill" style={{ background: "var(--coin)", color: "var(--ink)", border: "2.5px solid var(--ink)", fontSize: 15, padding: "6px 14px" }}>
        <Icon name="clock" size={18} strokeWidth={3} />Mở lại lúc {S.settings.start}
      </div>
      <div className="card" style={{ background: "#3A3168", borderColor: "#5D5293", boxShadow: "none", color: "var(--bg)", width: "100%", maxWidth: 420, textAlign: "left" }}>
        <div style={{ fontSize: 12, color: "#FFE08A", marginBottom: 8 }}>GỢI Ý CHƠI KHÔNG MÀN HÌNH</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {["Xếp hình", "Vẽ tranh", "Đá bóng với bố", "Đọc truyện", "Nấu ăn cùng mẹ"].map((x) => (
            <span key={x} className="pill" style={{ background: "var(--bg)", color: "var(--ink)", fontSize: 13 }}>{x}</span>
          ))}
        </div>
      </div>
      <button className="btn" onClick={A.logout}>Về màn chọn người</button>
    </main>
  );
}

const CONFETTI_COLORS = ["#FF6FA3", "#3DD6B5", "#8B6CFF", "#FF8A3D", "#FFFFFF"];

export function CelebrateOverlay() {
  const { S, U, A } = useApp();
  const c = U.celebrate!;
  let big = "", sub = "";
  let sticker: React.ReactNode = null;

  if (c.type === "coins") {
    const items = S.subs.filter((s) => c.ids.includes(s.id));
    const tot = items.reduce((t, s) => t + taskOf(S, s.task).coins, 0);
    const s0 = items[items.length - 1];
    const by = mem(S, s0?.by || "me");
    big = `+${tot} Ủn!`;
    sub = items.map((s) => taskOf(S, s.task).title).join(" · ");
    sticker = (
      <div className="card row" style={{ transform: "rotate(-3deg)", maxWidth: 320 }}>
        <Avatar m={by} size={40} fs={16} />
        <div>
          <div className="display" style={{ fontSize: 19, color: "#C2185B" }}>{s0?.sticker || "Giỏi quá!"}</div>
          <div style={{ fontSize: 13 }}>{by.name} đã gật đầu cho con</div>
        </div>
      </div>
    );
  } else if (c.type === "harvest") {
    big = `+${c.amount} Ủn!`;
    sub = `${c.title} đã cho quả${c.golden ? " vàng" : ""}, giỏi quá!`;
  } else if (c.type === "redeem") {
    big = "Đổi phiếu thành công!";
    sub = `Phiếu "${c.title}" đã ngoéo tay với bố mẹ`;
  } else {
    big = "Hũ đầy rồi!";
    sub = `Cả nhà cùng đi: ${S.jar.goal}`;
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Ăn mừng" style={{ background: "var(--coin)", flexDirection: "column", gap: 12, textAlign: "center" }}>
      {Array.from({ length: 14 }, (_, i) => (
        <i
          key={i}
          className="confetti"
          style={{
            left: `${(i * 37) % 100}%`, width: 9 + (i % 3) * 3, height: 14 + (i % 4) * 3,
            background: CONFETTI_COLORS[i % 5], border: "2px solid #3B2A1A", borderRadius: 4,
            animationDuration: `${3 + (i % 5) * 0.7}s`, animationDelay: `${-(i % 7) * 0.6}s`,
          }}
        />
      ))}
      <div className="bob"><Pig mood="joy" size={150} /></div>
      <div className="display" style={{ fontSize: c.type === "coins" ? 56 : 34, lineHeight: 0.95 }}>{big}</div>
      <div style={{ fontSize: 16, fontWeight: 800, maxWidth: 340 }}>{sub}</div>
      {sticker}
      <button className="btn big orange" style={{ maxWidth: 340 }} onClick={A.closeCelebrate}>
        {c.type === "coins" ? "Bỏ Ủn vào bụng heo" : "Yeah!"}
      </button>
    </div>
  );
}

export function Toast() {
  const { U } = useApp();
  if (!U.toast) return null;
  return <div className="toast" role="status">{U.toast.msg}</div>;
}
