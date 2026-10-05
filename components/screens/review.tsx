"use client";

import { useMemo, useState } from "react";
import { Coin } from "@/components/Coin";
import { Icon } from "@/components/Icon";
import { addDays, dowIdx, today } from "@/lib/data";
import { STICKER_INFO, STICKER_ORDER, bucket, rateOf, stickerInfo, topMissed, totalsOf, type DaySummary, type Totals } from "@/lib/review";
import { useApp } from "@/lib/store";
import { useReview } from "@/lib/use-review";
import { Avatar, Empty } from "./common";
import { WeeklyReport } from "./report";

type Mode = "day" | "week" | "month" | "year";
const MODES: { mode: Mode; label: string }[] = [{ mode: "day", label: "Ngày" }, { mode: "week", label: "Tuần" }, { mode: "month", label: "Tháng" }, { mode: "year", label: "Năm" }];
const DOW_LONG = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const DOW_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const dm = (ymd: string) => `${Number(ymd.slice(8, 10))}/${Number(ymd.slice(5, 7))}`;
const pct = (r: number) => `${Math.round(r * 100)}%`;
const monthOf = (ymd: string) => ymd.slice(0, 7);
const monthStart = (ymd: string) => `${monthOf(ymd)}-01`;
const addMonths = (ymd: string, n: number) => {
  const d = new Date(monthStart(ymd) + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const monthEnd = (ymd: string) => addDays(addMonths(ymd, 1), -1);
const MIN_YEAR_BACK = 3;

function StickerChips({ stickers, counts, size = "md" }: { stickers?: string[]; counts?: Record<string, number>; size?: "sm" | "md" }) {
  const items = counts
    ? STICKER_ORDER.filter((k) => counts[k]).map((k) => ({ k, n: counts[k] }))
    : (stickers ?? []).map((k) => ({ k, n: 0 }));
  if (!items.length) return <span className="muted">Chưa có sticker</span>;
  return (
    <span className="sticker-row">
      {items.map(({ k, n }) => {
        const s = stickerInfo(k);
        return <span key={k} className={`sticker-chip ${size}`} title={s.hint}><span aria-hidden="true">{s.emoji}</span>{s.name}{n > 0 && <b> ×{n}</b>}</span>;
      })}
    </span>
  );
}

function StickerLegend() {
  return (
    <details className="card flat" style={{ padding: "8px 12px" }}>
      <summary style={{ fontWeight: 800, cursor: "pointer", minHeight: 32, display: "flex", alignItems: "center" }}>Sticker được tặng thế nào?</summary>
      <div className="stack" style={{ gap: 6, marginTop: 8 }}>
        {STICKER_ORDER.map((k) => (
          <div key={k} className="row" style={{ gap: 8 }}>
            <span className="sticker-chip md"><span aria-hidden="true">{STICKER_INFO[k].emoji}</span>{STICKER_INFO[k].name}</span>
            <span className="muted grow">{STICKER_INFO[k].hint}</span>
          </div>
        ))}
        <div className="muted">Mỗi tối 21:00 máy tổng kết ngày và tặng sticker tự động. Việc con đã nộp, đang chờ gật đầu cũng được tính.</div>
      </div>
    </details>
  );
}

/* ---------- Thanh chọn ---------- */
function Stepper({ label, sub, onPrev, onNext, canPrev, canNext }: { label: string; sub?: string; onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean }) {
  return (
    <div className="row between" style={{ gap: 8 }}>
      <button className="btn sm" aria-label="Trước đó" disabled={!canPrev} onClick={onPrev}><Icon name="back" size={16} strokeWidth={3} /></button>
      <div style={{ textAlign: "center" }}>
        <div className="display" style={{ fontSize: 18 }}>{label}</div>
        {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
      </div>
      <button className="btn sm" aria-label="Sau đó" disabled={!canNext} onClick={onNext}>
        <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="back" size={16} strokeWidth={3} /></span>
      </button>
    </div>
  );
}

function Loading({ failed }: { failed: boolean }) {
  return <div className="card muted">{failed ? "Chưa tải được tổng kết, thử lại sau nhé." : "Đang tải tổng kết..."}</div>;
}

/* ---------- Tổng kết từng người trong nhiều ngày (tuần, tháng, năm) ---------- */
export function Insights({ rows }: { rows: DaySummary[] }) {
  const { S } = useApp();
  const people = S.members.filter((m) => rows.some((r) => r.member === m.id && r.planned > 0));
  const missed = topMissed(rows, 5);
  if (!people.length) return <Empty title="Chưa có dữ liệu" hint="Khi các bé làm việc tốt, tổng kết và sticker sẽ hiện ở đây." />;
  return (
    <>
      <div className="card stack" style={{ gap: 10 }}>
        <h3>Từng người</h3>
        {people.map((m) => {
          const t = totalsOf(rows, m.id);
          const miss = topMissed(rows, 3, m.id);
          return (
            <div key={m.id} className="stack" style={{ gap: 6, paddingTop: 8, borderTop: "2px dashed var(--sand)" }}>
              <div className="row" style={{ gap: 8 }}>
                <Avatar m={m} size={34} fs={14} />
                <div className="grow">
                  <b>{m.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{t.done}/{t.planned} việc · {t.perfectDays} ngày làm hết</div>
                </div>
                <span className="pill" style={{ background: "var(--coin-soft)" }}><Coin size={16} />{t.coins}</span>
              </div>
              <div className="bar" role="img" aria-label={`Đã làm ${pct(rateOf(t))}`}><i style={{ width: pct(rateOf(t)) }} /></div>
              <StickerChips counts={t.stickers} size="sm" />
              {miss.length > 0 && <div className="muted" style={{ fontSize: 12 }}>Hay bỏ sót: {miss.map((x) => `${x.title} (${x.count})`).join(", ")}</div>}
            </div>
          );
        })}
      </div>
      <div className="card stack" style={{ gap: 8 }}>
        <h3>Việc cần cải thiện nhiều nhất</h3>
        {missed.length === 0 && <div className="muted">Không có việc nào bị bỏ sót. Cả nhà làm rất tốt!</div>}
        {missed.map((x) => (
          <div key={x.title} className="row" style={{ gap: 8 }}>
            <Icon name="undo" size={16} strokeWidth={2.6} />
            <span className="grow" style={{ fontSize: 14 }}>{x.title}</span>
            <b>{x.count} lần</b>
          </div>
        ))}
      </div>
    </>
  );
}

function SummaryCards({ t, days, dayLabel = "Ngày làm hết việc" }: { t: Totals; days: number; dayLabel?: string }) {
  const stickerTotal = Object.values(t.stickers).reduce((a, b) => a + b, 0);
  return (
    <div className="report-cards">
      <div className="card" style={{ background: "var(--mint-soft)" }}><div className="muted">Việc đã làm</div><div className="display" style={{ fontSize: 30 }}>{pct(rateOf(t))}</div><div className="muted" style={{ fontSize: 12 }}>{t.done}/{t.planned} việc</div></div>
      <div className="card" style={{ background: "var(--coin-soft)" }}><div className="muted">Ủn kiếm được</div><div className="display row" style={{ fontSize: 30, gap: 6 }}><Coin size={26} />{t.coins}</div></div>
      <div className="card"><div className="muted">{dayLabel}</div><div className="display" style={{ fontSize: 30 }}>{days}</div></div>
      <div className="card"><div className="muted">Sticker</div><div className="display" style={{ fontSize: 30 }}>{stickerTotal}</div></div>
    </div>
  );
}

/** Số ngày mà cả nhà làm hết việc được giao (mọi người có việc trong ngày đều xong) */
function perfectFamilyDays(rows: DaySummary[]): number {
  const byDay = new Map<string, DaySummary[]>();
  for (const r of rows) (byDay.get(r.day) ?? byDay.set(r.day, []).get(r.day)!).push(r);
  return [...byDay.values()].filter((v) => v.some((r) => r.planned > 0) && v.every((r) => r.planned === 0 || r.done === r.planned)).length;
}

/* ---------- Ngày ---------- */
function DayView({ day, setDay }: { day: string; setDay: (d: string) => void }) {
  const { S, A } = useApp();
  const t0 = today();
  const { rows, loading, failed } = useReview(day, day);
  const nowHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(new Date()));
  const isToday = day === t0;
  const name = isToday ? "Hôm nay" : day === addDays(t0, -1) ? "Hôm qua" : DOW_LONG[dowIdx(day)];
  const people = S.members.filter((m) => rows?.some((r) => r.member === m.id));

  return (
    <>
      <Stepper label={`${name}, ${dm(day)}`} sub={isToday ? (nowHour >= 21 ? "Tổng kết cuối ngày" : "Ngày đang diễn ra, tổng kết chính thức lúc 21:00") : DOW_LONG[dowIdx(day)]}
        canPrev={day > addDays(t0, -400)} canNext={day < t0} onPrev={() => setDay(addDays(day, -1))} onNext={() => setDay(addDays(day, 1))} />
      {!isToday && <button className="btn sm" style={{ alignSelf: "center" }} onClick={() => setDay(t0)}>Về hôm nay</button>}
      {loading && <Loading failed={false} />}
      {failed && <Loading failed />}
      {rows && people.length === 0 && <Empty title="Ngày này chưa có việc nào" hint="Khi bố mẹ giao việc, tổng kết và sticker của ngày sẽ hiện ở đây." />}
      {rows && people.length > 0 && (
        <>
          <SummaryCards t={totalsOf(rows)} days={perfectFamilyDays(rows)} dayLabel="Cả nhà làm hết việc" />
          <div className="review-people">
            {people.map((m) => {
              const r = rows.find((x) => x.member === m.id)!;
              return (
                <section key={m.id} className="card stack" aria-label={`Tổng kết của ${m.name}`} style={{ gap: 8 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar m={m} size={40} fs={16} />
                    <div className="grow">
                      <b style={{ fontSize: 16 }}>{m.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{r.done}/{r.planned} việc</div>
                    </div>
                    <span className="pill" style={{ background: "var(--coin-soft)" }}><Coin size={16} />+{r.coins}</span>
                  </div>
                  <div className="bar" role="img" aria-label={`Đã làm ${pct(rateOf(r))}`}><i style={{ width: pct(rateOf(r)) }} /></div>
                  <div><div className="muted" style={{ marginBottom: 4 }}>Sticker hôm nay</div><StickerChips stickers={r.stickers} /></div>
                  {r.doneTitles.length > 0 && (
                    <div>
                      <div className="muted" style={{ marginBottom: 2 }}>Đã xong</div>
                      <ul className="review-list ok">{r.doneTitles.map((t, i) => <li key={i}><Icon name="check" size={14} strokeWidth={3.4} />{t}</li>)}</ul>
                    </div>
                  )}
                  <div>
                    <div className="muted" style={{ marginBottom: 2 }}>{isToday && nowHour < 21 ? "Còn lại hôm nay" : "Cần cải thiện hôm sau"}</div>
                    {r.missed.length === 0
                      ? <div style={{ fontWeight: 700, fontSize: 14 }}>Không bỏ sót việc nào. Tuyệt vời!</div>
                      : <ul className="review-list miss">{r.missed.map((t, i) => <li key={i}><Icon name="undo" size={14} strokeWidth={3} />{t}</li>)}</ul>}
                  </div>
                  {m.role === "kid" && <button className="btn sm" onClick={() => A.ptab("praise")}><Icon name="heart" size={16} strokeWidth={3} />Gửi lời khen cho {m.name}</button>}
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Tháng ---------- */
function heatLevel(r: Totals | undefined): number {
  if (!r || r.planned === 0) return 0;
  const x = rateOf(r);
  return x >= 1 ? 4 : x >= 0.7 ? 3 : x >= 0.4 ? 2 : 1;
}

function MonthView({ anchor, setAnchor, openDay }: { anchor: string; setAnchor: (d: string) => void; openDay: (d: string) => void }) {
  const t0 = today();
  const from = monthStart(anchor), to = monthEnd(anchor) < t0 ? monthEnd(anchor) : t0;
  const { rows, loading, failed } = useReview(from, to);
  const days = useMemo(() => {
    const n = Number(monthEnd(anchor).slice(8, 10));
    return Array.from({ length: n }, (_, i) => `${monthOf(anchor)}-${String(i + 1).padStart(2, "0")}`);
  }, [anchor]);
  const byDay = useMemo(() => (rows ? bucket(rows, (d) => d) : new Map<string, Totals>()), [rows]);
  const label = `Tháng ${Number(anchor.slice(5, 7))}/${anchor.slice(0, 4)}`;
  const canNext = monthOf(anchor) < monthOf(t0);
  return (
    <>
      <Stepper label={label} canPrev={monthOf(anchor) > monthOf(addDays(t0, -365 * MIN_YEAR_BACK))} canNext={canNext}
        onPrev={() => setAnchor(addMonths(anchor, -1))} onNext={() => setAnchor(addMonths(anchor, 1))} />
      {loading && <Loading failed={false} />}
      {failed && <Loading failed />}
      {rows && (
        <>
          <SummaryCards t={totalsOf(rows)} days={perfectFamilyDays(rows)} dayLabel="Ngày cả nhà làm hết" />
          <div className="card stack" style={{ gap: 8 }}>
            <h3>Lịch cả tháng</h3>
            <div className="heat" role="grid" aria-label={`Lịch ${label}`}>
              {DOW_SHORT.map((d) => <span key={d} className="heat-dow" role="columnheader">{d}</span>)}
              {Array.from({ length: dowIdx(days[0]) }, (_, i) => <span key={`b${i}`} />)}
              {days.map((d) => {
                const t = byDay.get(d);
                const lv = heatLevel(t);
                const future = d > t0;
                return (
                  <button key={d} role="gridcell" disabled={future} className={`heat-cell lv${lv} ${d === t0 ? "today" : ""}`}
                    aria-label={`Ngày ${Number(d.slice(8, 10))}: ${t && t.planned ? `${t.done}/${t.planned} việc` : "không có việc"}`} onClick={() => openDay(d)}>
                    {Number(d.slice(8, 10))}
                  </button>
                );
              })}
            </div>
            <div className="heat-legend muted" aria-hidden="true">
              <span className="heat-cell lv0 sm" />chưa có <span className="heat-cell lv1 sm" />ít <span className="heat-cell lv2 sm" /><span className="heat-cell lv3 sm" /><span className="heat-cell lv4 sm" />làm hết
            </div>
            <div className="muted">Bấm vào một ngày để xem chi tiết.</div>
          </div>
          <Insights rows={rows} />
        </>
      )}
    </>
  );
}

/* ---------- Năm ---------- */
function YearView({ anchor, setAnchor }: { anchor: string; setAnchor: (d: string) => void }) {
  const t0 = today();
  const year = Number(anchor.slice(0, 4));
  const from = `${year}-01-01`, to = `${year}-12-31` < t0 ? `${year}-12-31` : t0;
  const { rows, loading, failed } = useReview(from, to);
  const byMonth = useMemo(() => (rows ? bucket(rows, monthOf) : new Map<string, Totals>()), [rows]);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const maxCoins = Math.max(1, ...months.map((m) => byMonth.get(m)?.coins ?? 0));
  const thisYear = Number(t0.slice(0, 4));
  return (
    <>
      <Stepper label={`Năm ${year}`} canPrev={year > thisYear - MIN_YEAR_BACK} canNext={year < thisYear}
        onPrev={() => setAnchor(`${year - 1}-01-01`)} onNext={() => setAnchor(year + 1 === thisYear ? t0 : `${year + 1}-01-01`)} />
      {loading && <Loading failed={false} />}
      {failed && <Loading failed />}
      {rows && (
        <>
          <SummaryCards t={totalsOf(rows)} days={perfectFamilyDays(rows)} dayLabel="Ngày cả nhà làm hết" />
          <div className="card stack" style={{ gap: 8 }}>
            <h3>Từng tháng</h3>
            <div className="year-bars">
              {months.map((m, i) => {
                const t = byMonth.get(m);
                const r = t ? rateOf(t) : 0;
                return (
                  <div key={m} className="year-col" role="img" aria-label={`Tháng ${i + 1}: ${t && t.planned ? `${pct(r)} việc đã làm, ${t.coins} Ủn` : "chưa có dữ liệu"}`}>
                    <span className="year-val">{t && t.planned ? pct(r) : ""}</span>
                    <div className="year-bar"><i style={{ height: `${Math.max(t?.planned ? 6 : 2, r * 100)}%`, background: t?.planned ? "var(--mint)" : "var(--sand)" }} /></div>
                    <span className="year-coin" style={{ opacity: t?.coins ? 1 : 0 }}><i style={{ width: `${((t?.coins ?? 0) / maxCoins) * 100}%` }} /></span>
                    <span className="year-lbl">T{i + 1}</span>
                  </div>
                );
              })}
            </div>
            <div className="muted">Cột xanh: tỉ lệ việc đã làm. Thanh vàng bên dưới: Ủn kiếm được so với tháng nhiều nhất.</div>
          </div>
          <Insights rows={rows} />
        </>
      )}
    </>
  );
}

/* ---------- Khung Nhìn lại ---------- */
export function Review() {
  const t0 = today();
  const [mode, setMode] = useState<Mode>("day");
  const [anchor, setAnchor] = useState(t0);
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <h2>Nhìn lại</h2>
        <div className="muted" style={{ marginTop: 4 }}>Xem cả nhà đã làm gì theo ngày, tuần, tháng, năm. Sticker được tặng tự động, việc chưa làm tốt hiện ra để hôm sau cải thiện.</div>
      </div>
      <div className="rv-tabs" role="tablist" aria-label="Khoảng thời gian">
        {MODES.map((m) => (
          <button key={m.mode} role="tab" aria-selected={mode === m.mode} className={`btn sm ${mode === m.mode ? "coin" : ""}`} onClick={() => setMode(m.mode)}>{m.label}</button>
        ))}
      </div>
      {mode === "day" && <DayView day={anchor} setDay={setAnchor} />}
      {mode === "week" && <WeeklyReport extra={(start, end) => <WeekInsights start={start} end={end} />} />}
      {mode === "month" && <MonthView anchor={anchor} setAnchor={setAnchor} openDay={(d) => { setAnchor(d); setMode("day"); }} />}
      {mode === "year" && <YearView anchor={anchor} setAnchor={setAnchor} />}
      <StickerLegend />
    </div>
  );
}

function WeekInsights({ start, end }: { start: string; end: string }) {
  const { rows, loading, failed } = useReview(start, end < today() ? end : today());
  if (loading) return <Loading failed={false} />;
  if (failed || !rows) return <Loading failed />;
  return <Insights rows={rows} />;
}

