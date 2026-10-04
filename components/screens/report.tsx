"use client";

import { useEffect, useMemo, useState } from "react";
import { Coin } from "@/components/Coin";
import { Icon } from "@/components/Icon";
import type { WeekReport } from "@/lib/backend";
import { jarTotal, mem, today } from "@/lib/data";
import { useApp } from "@/lib/store";
import { Avatar } from "./common";
import { FamilyLeaderboard } from "./leaderboard";

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const dowOf = (ymd: string) => DOW[new Date(ymd + "T00:00:00Z").getUTCDay()];
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const MIN_OFFSET = -8; // dữ liệu việc tốt giữ 60 ngày, đủ cho khoảng 8 tuần

type Loaded = { offset: number; cur: WeekReport; prev: WeekReport };

export function WeeklyReport() {
  const { S, A } = useApp();
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  // Làm mới khi dữ liệu thay đổi (có người vừa được gật đầu, vừa đổi phiếu...)
  const version = Object.values(S.coins).reduce((a, b) => a + b, 0) + S.subs.length * 1000 + S.promises.length;
  useEffect(() => {
    let alive = true;
    Promise.all([A.weekReport(offset), A.weekReport(offset - 1)])
      .then(([cur, prev]) => { if (alive) { setLoaded({ offset, cur, prev }); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [A, offset, version]);

  const ready = loaded && loaded.offset === offset ? loaded : null;
  const label = offset === 0 ? "Tuần này" : offset === -1 ? "Tuần trước" : `${-offset} tuần trước`;

  const stats = useMemo(() => {
    if (!ready) return null;
    const sum = (r: WeekReport, f: (x: WeekReport["rows"][number]) => number) => r.rows.reduce((a, x) => a + f(x), 0);
    const perDay = ready.cur.days.map((d) => ready.cur.rows.filter((r) => r.day === d).reduce((a, r) => a + r.earned, 0));
    const best = perDay.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
    return {
      earned: sum(ready.cur, (r) => r.earned), prevEarned: sum(ready.prev, (r) => r.earned),
      tasks: sum(ready.cur, (r) => r.tasks), spent: sum(ready.cur, (r) => r.spent),
      perDay, bestDay: perDay[best] > 0 ? ready.cur.days[best] : null, maxDay: Math.max(1, ...perDay),
    };
  }, [ready]);

  // Việc làm nhiều nhất trong tuần đang xem (từ lịch sử 60 ngày đã tải)
  const topTasks = useMemo(() => {
    if (!ready) return [];
    const first = ready.cur.days[0], last = ready.cur.days[6];
    const count = new Map<string, number>();
    for (const s of S.subs) {
      if (s.status !== "approved" || s.date < first || s.date > last) continue;
      if (mem(S, s.member).role !== "kid") continue;
      count.set(s.task, (count.get(s.task) ?? 0) + 1);
    }
    return [...count.entries()]
      .map(([id, n]) => ({ task: S.tasks.find((t) => t.id === id), n }))
      .filter((x) => x.task)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
  }, [ready, S]);

  const delta = stats ? stats.earned - stats.prevEarned : 0;
  const pending = S.promises.filter((p) => p.status === "promised").length;
  const pct = Math.min(100, Math.round((jarTotal(S) / S.jar.target) * 100));

  return (
    <div className="stack" style={{ gap: 14 }}>
      {/* chọn tuần */}
      <div className="row between" style={{ gap: 8 }}>
        <button className="btn sm" aria-label="Tuần trước đó" disabled={offset <= MIN_OFFSET} onClick={() => setOffset(offset - 1)}>
          <Icon name="back" size={16} strokeWidth={3} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div className="display" style={{ fontSize: 18 }}>{label}</div>
          <div className="muted" style={{ fontSize: 12 }}>{ready ? `${dm(ready.cur.days[0])} – ${dm(ready.cur.days[6])}` : "…"}</div>
        </div>
        <button className="btn sm" aria-label="Tuần sau" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
          <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="back" size={16} strokeWidth={3} /></span>
        </button>
      </div>

      {failed && <div className="card">Chưa tải được báo cáo, thử lại sau nhé.</div>}
      {!ready && !failed && <div className="card muted">Đang tải báo cáo...</div>}

      {ready && stats && (
        <>
          <div className="report-cards">
            <div className="card" style={{ background: "var(--coin-soft)" }}>
              <div className="muted">Ủn cả nhà kiếm được</div>
              <div className="display row" style={{ fontSize: 30, gap: 6 }}><Coin size={26} />{stats.earned}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: delta >= 0 ? "#0F766E" : "#C2185B" }}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} so với tuần liền trước
              </div>
            </div>
            <div className="card"><div className="muted">Việc tốt được gật đầu</div><div className="display" style={{ fontSize: 30 }}>{stats.tasks}</div></div>
            <div className="card"><div className="muted">Ủn đã tiêu (phiếu, hũ)</div><div className="display" style={{ fontSize: 30 }}>{stats.spent}</div></div>
            <div className="card"><div className="muted">Ngày nhiều Ủn nhất</div><div className="display" style={{ fontSize: 24 }}>{stats.bestDay ? `${dowOf(stats.bestDay)} · ${dm(stats.bestDay)}` : "Chưa có"}</div></div>
          </div>

          {/* biểu đồ cột theo ngày */}
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Ủn của cả nhà theo ngày</h3>
            <div aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 130 }}>
              {ready.cur.days.map((d, i) => {
                const v = stats.perDay[i];
                const isToday = d === today();
                return (
                  <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4, height: "100%" }}>
                    <span style={{ fontSize: 11, fontWeight: 800 }}>{v || ""}</span>
                    <div style={{ width: "100%", height: `${Math.max(v ? 6 : 2, (v / stats.maxDay) * 90)}px`, background: v ? (isToday ? "var(--orange)" : "var(--mint)") : "var(--sand)", border: "2px solid var(--ink)", borderRadius: "8px 8px 3px 3px" }} />
                    <span style={{ fontSize: 11, fontWeight: isToday ? 900 : 700 }}>{dowOf(d)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* bảng từng người */}
          <div className="card" style={{ overflowX: "auto" }}>
            <h3 style={{ marginBottom: 8 }}>Từng người trong tuần</h3>
            <table className="tbl" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>Thành viên</th>
                  {ready.cur.days.map((d) => <th key={d} style={{ textAlign: "right" }}>{dowOf(d)}</th>)}
                  <th style={{ textAlign: "right" }}>Tổng</th><th style={{ textAlign: "right" }}>Việc</th><th style={{ textAlign: "right" }}>Tiêu</th>
                </tr>
              </thead>
              <tbody>
                {S.members.map((m) => {
                  const rows = ready.cur.rows.filter((r) => r.member === m.id);
                  const by = new Map(rows.map((r) => [r.day, r]));
                  const tot = rows.reduce((a, r) => a + r.earned, 0);
                  return (
                    <tr key={m.id}>
                      <td><span className="row" style={{ gap: 6 }}><Avatar m={m} size={24} fs={10} />{m.name}</span></td>
                      {ready.cur.days.map((d) => {
                        const e = by.get(d)?.earned ?? 0;
                        return <td key={d} style={{ textAlign: "right", color: e ? "var(--ink)" : "#b5a99a" }}>{e || "·"}</td>;
                      })}
                      <td style={{ textAlign: "right", fontWeight: 900 }}>{tot}</td>
                      <td style={{ textAlign: "right" }}>{rows.reduce((a, r) => a + r.tasks, 0)}</td>
                      <td style={{ textAlign: "right" }}>{rows.reduce((a, r) => a + r.spent, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="muted" style={{ marginTop: 6 }}>Ủn kiếm được chỉ tính việc làm và chấm Đạt, không tính tiền hoàn lại khi huỷ phiếu.</div>
          </div>

          {/* việc làm nhiều nhất */}
          <div className="card stack" style={{ gap: 8 }}>
            <h3>Việc tốt các con làm nhiều nhất</h3>
            {topTasks.length === 0 && <div className="muted">Tuần này chưa có việc nào được gật đầu.</div>}
            {topTasks.map(({ task, n }) => task && (
              <div key={task.id} className="row" style={{ gap: 8 }}>
                <div className="icon-box" style={{ width: 32, height: 32, background: task.bg }}><Icon name={task.icon} size={18} /></div>
                <span className="grow" style={{ fontSize: 14 }}>{task.title}</span>
                <b>{n} lần</b>
              </div>
            ))}
          </div>
        </>
      )}

      {/* hũ, ngoéo tay */}
      <div className="report-cards">
        <div className="card">
          <div className="muted">Hũ Mơ Ước · {S.jar.goal}</div>
          <div className="display" style={{ fontSize: 22 }}>{jarTotal(S)}/{S.jar.target} Ủn</div>
          <div className="bar" style={{ marginTop: 8 }}><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="card"><div className="muted">Lời ngoéo tay chưa thực hiện</div><div className="display" style={{ fontSize: 30 }}>{pending}</div></div>
      </div>

      <FamilyLeaderboard />
    </div>
  );
}
