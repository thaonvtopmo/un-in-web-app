"use client";

import { useEffect, useState } from "react";
import { Coin } from "@/components/Coin";
import { Icon, type IconName } from "@/components/Icon";
import { Pig } from "@/components/Pig";
import { SLOTS, TIERS, fmt, jarTotal, kidTasks, mem, parentTasks, partnerLabel, pigLevelOf, rewardOf, subOf } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { Challenge, KidScreen, Task } from "@/lib/types";
import { Avatar } from "./common";
import { FamilyLeaderboard } from "./leaderboard";

/* ---------- thành phần dùng lại ---------- */
function KidHeader() {
  const { S, U } = useApp();
  const m = mem(S, U.member!);
  return (
    <header className="row">
      <Avatar m={m} size={44} fs={19} />
      <div className="grow">
        <div className="display" style={{ fontSize: 21 }}>Chào {m.name}!</div>
        <div className="row" style={{ gap: 4, fontSize: 12, color: "#C2410C", fontWeight: 800 }}>
          <Icon name="flame" size={14} strokeWidth={2.4} />Chuỗi {S.streak[m.id] || 0} ngày liền
        </div>
      </div>
      <div className="coin-pill" aria-label="Số Ủn"><Coin size={24} />{S.coins[m.id]}</div>
    </header>
  );
}

function TimerPill() {
  const { U } = useApp();
  const [left, setLeft] = useState(() => (U.timerEnd ? U.timerEnd - Date.now() : 0));
  useEffect(() => {
    const t = setInterval(() => setLeft(U.timerEnd ? U.timerEnd - Date.now() : 0), 1000);
    return () => clearInterval(t);
  }, [U.timerEnd]);
  return (
    <span className="row" role="timer" aria-label="Thời gian chơi còn lại" style={{ gap: 6, background: "var(--ink)", color: "#FFC93C", borderRadius: 999, padding: "4px 12px", fontSize: 13 }}>
      <Icon name="hourglass" size={16} strokeWidth={2.8} color="#FFC93C" />
      <span className="display" style={{ fontSize: 17 }}>{fmt(left)}</span>
    </span>
  );
}

/** Thanh trên cùng ở mọi màn của con: ai đang chơi, còn bao nhiêu phút, và nút Thoát để đổi người */
function KidTopBar() {
  const { S, U, A } = useApp();
  const m = mem(S, U.member!);
  return (
    <div className="kid-top">
      <Avatar m={m} size={32} fs={14} />
      <b className="grow" style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</b>
      {U.timerEnd && <TimerPill />}
      <button className="btn sm" onClick={A.logout} aria-label="Thoát, về màn chọn người"><Icon name="back" size={16} strokeWidth={3} />Thoát</button>
    </div>
  );
}

function TaskCard({ t, k }: { t: Task; k: string }) {
  const { S, A } = useApp();
  const s = subOf(S, k, t.id);
  const st = s ? s.status : "todo";
  let right: React.ReactNode;
  if (st === "approved")
    right = <div className="avatar" style={{ width: 34, height: 34, background: "var(--mint)" }} title="Đã nhận Ủn"><Icon name="check" size={18} strokeWidth={3.6} /></div>;
  else if (st === "pending")
    right = <span className="pill"><Icon name="clock" size={13} strokeWidth={3} />Chờ gật đầu</span>;
  else
    right = <button className="btn sm orange" onClick={() => A.done(t.id)}>{st === "redo" ? "Làm lại" : "Xong rồi nè!"}</button>;

  return (
    <div className="card row" style={{ padding: "8px 10px" }}>
      <div className="icon-box" style={{ background: t.bg }}><Icon name={t.icon} size={22} /></div>
      <div className="grow">
        <div className="display" style={{ fontSize: 15 }}>{t.title}</div>
        {t.who === "together" && (
          <span className="pill" style={{ background: "var(--pink-soft)", fontSize: 11, padding: "1px 8px", margin: "2px 0" }}>
            <Icon name="heart" size={11} strokeWidth={3} />Cùng {partnerLabel(S, t)}
          </span>
        )}
        <div style={{ fontWeight: 900, fontSize: 12, color: "#B45309" }}>
          +{t.coins} Ủn{t.who === "together" ? " cho mỗi người" : ""}
          {st === "redo" && <span style={{ color: "#C2185B" }}> · Bố mẹ nhắc làm lại</span>}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ---------- Trang chủ ---------- */
function Home() {
  const { S, U, A } = useApp();
  const k = U.member!;
  const kt = kidTasks(S);
  const left = kt
    .filter((t) => subOf(S, k, t.id)?.status !== "approved")
    .sort((a, b) => Number(b.who === "together") - Number(a.who === "together"));
  const jt = jarTotal(S);
  const pct = Math.min(100, Math.round((jt / S.jar.target) * 100));
  const prom = S.promises.filter((p) => p.member === k && p.status === "promised");
  const pig = pigLevelOf(S.streak[k] || 0);

  return (
    <>
      <KidHeader />
      <div className="home-grid">
        <div className="stack">
          <div className="row" style={{ alignItems: "flex-end" }}>
            <Pig mood="happy" size={84} level={pig.level} />
            <div className="card grow" style={{ borderRadius: "18px 18px 18px 5px", marginBottom: 22, fontSize: 15, fontWeight: 800 }}>
              {kt.length === 0 ? "Hôm nay bố mẹ chưa giao việc nào. Chơi vui nhé!" : left.length ? <>Làm thêm <span style={{ color: "#C2410C" }}>{left.length} việc</span> nữa là xong ngày hôm nay đó!</> : "Hôm nay con làm hết rồi, siêu quá!"}
            </div>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="pill" style={{ background: "var(--pink-soft)" }}>{pig.name} · cấp {pig.level}</span>
            {pig.next && <span className="muted" style={{ fontSize: 12 }}>Còn {pig.next.daysLeft} ngày liền nữa là lên {pig.next.name}</span>}
          </div>
          <div className="row between">
            <h2>Việc tốt hôm nay</h2>
            <button className="btn sm" onClick={() => A.go("missions")}>Xem hết ({kt.length})</button>
          </div>
          <div className="stack">
            {left.length ? left.slice(0, 3).map((t) => <TaskCard key={t.id} t={t} k={k} />) : <div className="card">{kt.length === 0 ? "Bố mẹ sẽ giao việc cho con sớm thôi!" : "Hết việc tốt rồi! Đi chơi với bố mẹ thôi."}</div>}
          </div>
        </div>
        <div className="stack">
          <button className="card stack" onClick={() => A.go("jar")} style={{ background: "var(--mint-soft)", gap: 8 }}>
            <span className="row between" style={{ fontWeight: 800, fontSize: 13 }}>
              <span>Hũ Mơ Ước: {S.jar.goal}</span>
              <span className="display" style={{ fontSize: 15 }}>{jt}/{S.jar.target}</span>
            </span>
            <span className="bar" style={{ display: "block" }}><i style={{ width: `${pct}%` }} /></span>
          </button>
          <div className="grid2">
            <button className="btn big pink" onClick={() => A.go("shop")}><Icon name="gift" size={22} />Đổi phiếu</button>
            <button className="btn big purple" onClick={() => A.go("arena")}><Icon name="trophy" size={22} />Đường đua</button>
          </div>
          <button className="btn big coin" onClick={() => A.go("judge")}><Icon name="star" size={22} />Con làm giám khảo</button>
          {prom.length > 0 && (
            <div className="card row" style={{ background: "var(--ink)", color: "var(--bg)", borderStyle: "dashed", borderColor: "var(--coin)" }}>
              <Icon name="ticket" size={22} color="#FFC93C" />
              <div className="grow" style={{ fontSize: 13 }}>
                Đã ngoéo tay: <b style={{ color: "#FFC93C" }}>{prom.map((p) => rewardOf(S, p.reward).title).join(", ")}</b>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- Việc tốt ---------- */
function Missions() {
  const { S, U } = useApp();
  const k = U.member!;
  const kt = kidTasks(S);
  const d = kt.filter((t) => subOf(S, k, t.id)?.status === "approved").length;
  const pct = kt.length ? Math.round((d / kt.length) * 100) : 0;
  const together = kt.filter((t) => t.who === "together");
  return (
    <>
      <div className="row between">
        <h1>Việc tốt hôm nay</h1>
        <span className="display" style={{ fontSize: 17, background: "var(--coin)", border: "2.5px solid var(--ink)", borderRadius: 999, padding: "2px 12px" }}>{d}/{kt.length}</span>
      </div>
      <div className="bar" style={{ height: 14 }}><i style={{ width: `${pct}%` }} /></div>
      <div className="muted">Bấm &quot;Xong rồi nè!&quot; rồi chờ bố mẹ gật đầu để nhận Ủn nhé</div>
      {together.length > 0 && (
        <div className="card stack" style={{ background: "var(--pink-soft)", gap: 8 }}>
          <div className="row">
            <span className="section-label" style={{ color: "#C2185B", margin: 0 }}>LÀM CÙNG NHAU</span>
            <span className="pill" style={{ background: "#fff" }}>Cả hai cùng được Ủn</span>
          </div>
          {together.map((t) => <TaskCard key={t.id} t={t} k={k} />)}
        </div>
      )}
      <div className="home-grid" style={{ alignItems: "start" }}>
        {(Object.keys(SLOTS) as (keyof typeof SLOTS)[]).map((sl) => {
          const ts = kt.filter((t) => t.slot === sl && t.who === "kid");
          if (!ts.length) return null;
          return (
            <div key={sl} className="stack" style={{ gap: 8 }}>
              <div className="section-label" style={{ color: SLOTS[sl].color }}>{SLOTS[sl].label}</div>
              {ts.map((t) => <TaskCard key={t.id} t={t} k={k} />)}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Phiếu đi chơi ---------- */
function Shop() {
  const { S, U, A } = useApp();
  const k = U.member!;
  const c = S.coins[k];
  const prom = S.promises.filter((p) => p.member === k && p.status === "promised");
  return (
    <>
      <div className="row between">
        <h1>Phiếu đi chơi</h1>
        <div className="coin-pill"><Coin size={22} />{c}</div>
      </div>
      {prom.map((p) => (
        <div key={p.id} className="card row" style={{ background: "var(--ink)", color: "var(--bg)", borderStyle: "dashed", borderColor: "var(--coin)" }}>
          <Icon name="ticket" size={22} color="#FFC93C" />
          <div className="grow" style={{ fontSize: 13 }}>Đã ngoéo tay: <b style={{ color: "#FFC93C" }}>{rewardOf(S, p.reward).title}</b> · {p.at}</div>
        </div>
      ))}
      {(Object.keys(TIERS) as (keyof typeof TIERS)[]).map((tr) => {
        const rs = S.rewards.filter((r) => r.tier === tr);
        if (!rs.length) return null;
        return (
          <div key={tr} className="stack" style={{ gap: 8 }}>
            <div className="section-label" style={{ color: TIERS[tr].color }}>{TIERS[tr].label}</div>
            <div className="shop-grid">
              {rs.map((r) => {
                const ok = c >= r.cost;
                return (
                  <div key={r.id} className="card stack" style={{ padding: 10, gap: 8, ...(ok ? {} : { background: "var(--sand)", boxShadow: "none" }) }}>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="icon-box" style={{ width: 36, height: 36, background: r.bg }}><Icon name={r.icon} size={20} /></div>
                      <div className="display grow" style={{ fontSize: 14 }}>{r.title}</div>
                    </div>
                    {ok ? (
                      <button className="btn sm mint" onClick={() => A.redeem(r.id)}>Đổi · {r.cost} Ủn</button>
                    ) : (
                      <div className="pill" style={{ justifyContent: "center", background: "#fff", border: "2px dashed var(--ink)", borderRadius: 12, minHeight: 44 }}>
                        <Icon name="lock" size={13} strokeWidth={3} />Còn thiếu {r.cost - c}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------- Đường đua ---------- */
export function ChallengeCard({ c }: { c: Challenge }) {
  const { S } = useApp();
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row">
        <span className="pill" style={{ background: "var(--pink)", border: "2px solid var(--ink)" }}>KÈO CẢ NHÀ</span>
        <span className="muted">còn {c.daysLeft} ngày</span>
      </div>
      <div className="display" style={{ fontSize: 17 }}>{mem(S, c.a).name} vs {mem(S, c.b).name}: {c.title}</div>
      {[c.a, c.b].map((id) => (
        <div key={id} className="row">
          <b style={{ width: 36, fontSize: 14 }}>{mem(S, id).name}</b>
          <div className="row grow" style={{ gap: 5, flexWrap: "wrap" }}>
            {Array.from({ length: c.target }, (_, i) => (
              <i key={i} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px ${i < c.prog[id] ? "solid" : "dashed"} var(--ink)`, background: i < c.prog[id] ? mem(S, id).color : "#fff", display: "block", flexShrink: 0 }} />
            ))}
          </div>
          <b className="display" style={{ fontSize: 16 }}>{c.prog[id]}/{c.target}</b>
        </div>
      ))}
      <div style={{ background: "var(--bg)", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 800 }}>{c.prize}</div>
    </div>
  );
}

function Arena() {
  const { S, U, A } = useApp();
  const k = U.member!;
  const ids = [k, ...S.members.filter((m) => m.role === "parent").map((m) => m.id)];
  const ranked = ids.map((id) => ({ id, v: S.week[id] || 0 })).sort((a, b) => b.v - a.v);
  const rk = (id: string) => ranked.findIndex((r) => r.id === id) + 1;
  const H: Record<number, number> = { 1: 96, 2: 72, 3: 56 };
  const chs = S.challenges.filter((c) => c.a === k || c.b === k);
  const diff = (S.week[k] || 0) - (S.lastWeek[k] || 0);
  const others = S.members.filter((m) => m.role === "kid" && m.id !== k);
  return (
    <>
      <div>
        <h1>Đường đua tuần này</h1>
        <div className="muted">Con thi với bố mẹ · anh chị em thi với chính mình</div>
      </div>
      <div className="podium" style={{ minHeight: 210, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        {[ranked[1], ranked[0], ranked[2]].filter(Boolean).map((r) => {
          const m = mem(S, r.id), n = rk(r.id);
          return (
            <div key={r.id}>
              {n === 1 && (
                <svg width="28" height="22" viewBox="0 0 34 26" aria-hidden="true"><path d="M3 23L5 5l7 7 5-10 5 10 7-7 2 18z" fill="#FFC93C" stroke="#3B2A1A" strokeWidth="2.6" strokeLinejoin="round" /></svg>
              )}
              <Avatar m={m} size={n === 1 ? 54 : 46} fs={n === 1 ? 22 : 18} />
              <div className="display" style={{ fontSize: 14 }}>{m.name} · {r.v}</div>
              <div className="block" style={{ height: H[n], background: n === 1 ? "var(--coin)" : "#fff", fontSize: 26 }}>{n}</div>
            </div>
          );
        })}
      </div>
      {chs.map((c) => <ChallengeCard key={c.id} c={c} />)}
      <div className="home-grid" style={{ alignItems: "start" }}>
        <div className="card row">
          <div className="avatar" style={{ width: 40, height: 40, background: "var(--mint)" }}><Icon name="up" size={20} strokeWidth={3} /></div>
          <div className="grow">
            <div className="display" style={{ fontSize: 15 }}>{diff >= 0 ? `${mem(S, k).name} giỏi hơn tuần trước` : "Tuần này cố thêm chút nhé"}</div>
            <div style={{ fontSize: 12 }}>{S.lastWeek[k]} → {S.week[k]} Ủn · <b style={{ color: "#0F766E" }}>{diff >= 0 ? "+" : ""}{diff}</b></div>
          </div>
        </div>
        {others.map((o) => {
          const d = (S.week[o.id] || 0) - (S.lastWeek[o.id] || 0);
          return (
            <div key={o.id} className="card row">
              <Avatar m={o} size={40} fs={18} />
              <div className="grow">
                <div className="display" style={{ fontSize: 15 }}>{o.name} thi với chính mình</div>
                <div style={{ fontSize: 12 }}>Tuần này {d >= 0 ? "+" : ""}{d} Ủn so với tuần trước</div>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn big purple" onClick={() => A.go("summary")}><Icon name="star" size={20} />Lễ trao giải Chủ nhật</button>
      <FamilyLeaderboard />
    </>
  );
}

function Summary() {
  const { S, A } = useApp();
  const all = S.members.map((m) => ({ m, w: S.week[m.id] || 0, d: (S.week[m.id] || 0) - (S.lastWeek[m.id] || 0) }));
  const fam = all.reduce((a, x) => a + x.w, 0);
  const best = [...all].sort((a, b) => b.d - a.d)[0];
  return (
    <>
      <div className="row">
        <button className="btn sm" onClick={() => A.go("arena")} aria-label="Quay lại"><Icon name="back" size={16} strokeWidth={3} /></button>
        <h1>Lễ trao giải tuần</h1>
      </div>
      <div className="home-grid" style={{ alignItems: "start" }}>
        <div className="card stack" style={{ alignItems: "center", textAlign: "center", background: "var(--coin)", gap: 6 }}>
          <div className="bob"><Pig mood="joy" size={110} /></div>
          <div style={{ fontWeight: 800 }}>Cả nhà kiếm được</div>
          <div className="display" style={{ fontSize: 44 }}>{fam} Ủn</div>
        </div>
        <div className="stack">
          <div className="card row">
            <Avatar m={best.m} size={48} fs={19} />
            <div className="grow">
              <div className="muted">Tiến bộ nhất tuần</div>
              <div className="display" style={{ fontSize: 19 }}>{best.m.name} · +{best.d} Ủn</div>
            </div>
            <Icon name="trophy" size={28} />
          </div>
          <div className="card stack">
            {all.map((x) => (
              <div key={x.m.id} className="row">
                <Avatar m={x.m} size={32} fs={13} />
                <b className="grow">{x.m.name}</b>
                <span className="display" style={{ fontSize: 15 }}>{x.w} Ủn</span>
                <span className="pill" style={{ background: x.d >= 0 ? "var(--mint-soft)" : "var(--pink-soft)" }}>{x.d >= 0 ? "+" : ""}{x.d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Hũ Mơ Ước ---------- */
function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} giờ trước`;
  return `${Math.round(mins / 1440)} ngày trước`;
}

/** Màn Hũ chung: dùng chung cho con và bố mẹ, góp từ ví của người đang đăng nhập */
export function Jar() {
  const { S, U, A } = useApp();
  const k = U.member!;
  const t = jarTotal(S), tg = S.jar.target;
  const fh = Math.round(162 * Math.min(1, t / tg));
  const max = Math.max(1, ...Object.values(S.jar.contrib));
  const wallet = S.members.reduce((a, m) => a + (S.coins[m.id] || 0), 0);
  const weekTotal = S.members.reduce((a, m) => a + (S.week[m.id] || 0), 0);
  const left = Math.max(0, tg - t);
  const mine = S.coins[k] || 0;
  const P = "M70 32v16c-30 10-46 30-46 64v90a20 20 0 0 0 20 20h112a20 20 0 0 0 20-20v-90c0-34-16-54-46-64V32z";
  const coins = [[60, 205], [92, 200], [126, 206], [152, 196], [76, 178], [110, 176], [140, 170], [54, 160], [94, 152], [126, 146], [70, 130], [110, 124], [146, 120], [86, 100], [124, 96]]
    .filter(([, y]) => y - 6 > 222 - fh);
  return (
    <>
      <div>
        <h1>Hũ Mơ Ước cả nhà</h1>
        <div className="muted">Cùng góp Ủn, cùng đi chơi, không ai thua!</div>
      </div>
      <div className="home-grid" style={{ alignItems: "start" }}>
        <div className="stack" style={{ alignItems: "center" }}>
          <div className="card row" style={{ borderRadius: 999, padding: "6px 14px" }}>
            <Icon name="paw" size={20} /><span className="display" style={{ fontSize: 16 }}>Mục tiêu: {S.jar.goal}</span>
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <svg width="170" height="204" viewBox="0 0 200 240" aria-hidden="true">
              <defs><clipPath id="jc"><path d={P} /></clipPath></defs>
              <path d={P} fill="#fff" fillOpacity=".8" />
              <g clipPath="url(#jc)">
                <rect x="0" y={222 - fh} width="200" height={fh} fill="#FFC93C" />
                {coins.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="13" fill="#FFE08A" stroke="#3B2A1A" strokeWidth="2.5" />)}
              </g>
              <path d={P} fill="none" stroke="#3B2A1A" strokeWidth="4" strokeLinejoin="round" />
              <rect x="58" y="8" width="84" height="26" rx="8" fill="#FF8A3D" stroke="#3B2A1A" strokeWidth="4" />
              <path d="M44 80c-6 10-8 22-8 34" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <div className="display" style={{ position: "absolute", top: 78, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "var(--bg)", borderRadius: 12, padding: "3px 10px", fontSize: 20, whiteSpace: "nowrap" }}>{t}/{tg}</div>
          </div>
          <div className="muted" style={{ textAlign: "center" }}>{S.jar.reached ? "Hũ đã đầy!" : `Còn thiếu ${left} Ủn nữa là đầy hũ`}</div>

          {S.jar.reached ? (
            <div className="card" style={{ background: "var(--coin-soft)", textAlign: "center", width: "100%" }}>Hũ đầy rồi! Chờ bố mẹ đặt mục tiêu mới nhé.</div>
          ) : (
            <div className="stack" style={{ width: "100%", gap: 8 }}>
              <div className="muted" style={{ textAlign: "center" }}>{mem(S, k).name} đang có {mine} Ủn. Góp bao nhiêu?</div>
              <div className="grid3">
                {[10, 20, 50].map((n) => (
                  <button key={n} className="btn big coin" onClick={() => A.give(n)} disabled={mine < n}><Coin size={20} />{n}</button>
                ))}
              </div>
              {mine > 0 && mine !== 10 && mine !== 20 && mine !== 50 && (
                <button className="btn" onClick={() => A.give(Math.min(mine, left))} disabled={left === 0}>Góp hết ({Math.min(mine, left)} Ủn)</button>
              )}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card stack" style={{ background: "var(--mint-soft)", gap: 8 }}>
            <h3>Cả nhà đang tích được</h3>
            <div className="report-cards">
              <div><div className="muted">Trong hũ</div><div className="display" style={{ fontSize: 24 }}>{t} Ủn</div></div>
              <div><div className="muted">Ví cả nhà đang có</div><div className="display" style={{ fontSize: 24 }}>{wallet} Ủn</div></div>
              <div><div className="muted">Kiếm được tuần này</div><div className="display" style={{ fontSize: 24 }}>{weekTotal} Ủn</div></div>
            </div>
          </div>

          <div className="card stack">
            <h3>Từng người</h3>
            {S.members.map((m) => {
              const v = S.jar.contrib[m.id] || 0;
              return (
                <div key={m.id} className="stack" style={{ gap: 4 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar m={m} size={30} fs={13} />
                    <b className="grow" style={{ fontSize: 14 }}>{m.name}</b>
                    <span className="muted" style={{ fontSize: 12 }}>ví {S.coins[m.id] || 0}</span>
                    <b style={{ fontSize: 14 }}>góp {v}</b>
                  </div>
                  <div style={{ height: 10, background: "var(--sand)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((v / max) * 100)}%`, height: "100%", background: m.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card stack" style={{ gap: 6 }}>
            <h3>Góp gần đây</h3>
            {S.jarLog.length === 0 && <div className="muted">Chưa ai góp. Người đầu tiên là {mem(S, k).name} nhé!</div>}
            {S.jarLog.slice(0, 6).map((l, i) => (
              <div key={i} className="row" style={{ gap: 8, fontSize: 14 }}>
                <Avatar m={mem(S, l.member)} size={26} fs={11} />
                <span className="grow"><b>{mem(S, l.member).name}</b> góp {l.amount} Ủn</span>
                <span className="muted" style={{ fontSize: 12 }}>{ago(l.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Con làm giám khảo ---------- */
function Judge() {
  const { S, U, A } = useApp();
  const k = U.member!;
  const parents = S.members.filter((m) => m.role === "parent");
  const p = mem(S, U.judgeFor);
  const pts = parentTasks(S, undefined, p.id);
  const sum = pts.filter((t) => subOf(S, p.id, t.id)?.status === "approved").reduce((a, t) => a + t.coins, 0);
  return (
    <>
      <div className="row">
        <Pig mood="judge" size={80} />
        <div>
          <div style={{ fontSize: 13, color: "#9D174D", fontWeight: 800 }}>Giám khảo {mem(S, k).name} ơi</div>
          <h1>Hôm nay {p.name} làm tốt chưa?</h1>
        </div>
      </div>
      <div className="tabs">
        {parents.map((x) => (
          <button key={x.id} className={`btn sm ${x.id === p.id ? "coin" : ""}`} onClick={() => A.judgeFor(x.id)}>Chấm {x.name}</button>
        ))}
      </div>
      <div className="home-grid" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 8 }}>
          {pts.length === 0 && <div className="card">{p.name} chưa có mục nào để chấm. Bố mẹ thêm ở Góc bố mẹ nhé.</div>}
          {pts.map((t) => {
            const ok = subOf(S, p.id, t.id)?.status === "approved";
            return (
              <div key={t.id} className="card row" style={{ padding: "8px 10px" }}>
                <div className="icon-box" style={{ background: t.bg }}><Icon name={t.icon} size={22} /></div>
                <div className="grow">
                  <div className="display" style={{ fontSize: 15 }}>{t.title}</div>
                  <div style={{ fontWeight: 900, fontSize: 12, color: "#B45309" }}>+{t.coins} Ủn cho {p.name}</div>
                </div>
                <button className={`btn sm ${ok ? "mint" : "ghost"}`} style={{ minWidth: 84 }} onClick={() => A.judge(t.id)} aria-pressed={ok}>
                  {ok ? <><Icon name="check" size={16} strokeWidth={3.6} />Đạt</> : "Chấm"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="card row" style={{ background: "var(--ink)", color: "var(--bg)" }}>
          <Coin size={36} />
          <div className="grow">
            <div style={{ fontSize: 12 }}>{mem(S, k).name} chấm cho {p.name}</div>
            <div className="display" style={{ fontSize: 22, color: "#FFC93C" }}>+{sum} Ủn</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Khung của con ---------- */
const TABS: [KidScreen, IconName, string][] = [
  ["home", "home", "Nhà"], ["missions", "list", "Việc tốt"], ["arena", "trophy", "Đường đua"],
  ["shop", "gift", "Đi chơi"], ["jar", "jar", "Hũ Mơ Ước"],
];

export function KidShell() {
  const { U, A } = useApp();
  const views: Record<KidScreen, () => React.ReactNode> = {
    home: Home, missions: Missions, arena: Arena, shop: Shop, jar: Jar, judge: Judge, summary: Summary,
  };
  const View = views[U.screen as KidScreen] ?? Home;

  // Hết giờ chơi thì chuyển sang màn "Hết giờ chơi rồi"
  useEffect(() => {
    if (!U.timerEnd) return;
    const t = setInterval(() => { if (Date.now() >= U.timerEnd!) A.timeout(); }, 1000);
    return () => clearInterval(t);
  }, [U.timerEnd, A]);

  // Mỗi 30 giây báo server: cộng phút đã chơi (nếu bố mẹ bật giới hạn) và kiểm tra giờ vàng. Server mới là nơi quyết định.
  useEffect(() => {
    const t = setInterval(() => void A.heartbeat(), 30000);
    return () => clearInterval(t);
  }, [A]);

  return (
    <>
      <main className="app">
        <KidTopBar />
        <View />
      </main>
      <nav className="nav" aria-label="Điều hướng">
        {TABS.map(([s, i, l]) => (
          <button key={s} className={U.screen === s ? "on" : ""} onClick={() => A.go(s)} aria-current={U.screen === s ? "page" : undefined}>
            <Icon name={i} size={20} />{l}
          </button>
        ))}
      </nav>
    </>
  );
}
