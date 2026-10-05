"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import "./admin.css";

/* ---------- Kiểu dữ liệu từ các hàm admin_* ---------- */
type Overview = {
  role: string; now: string;
  totals: { families: number; members: number; kids: number; new_7d: number; new_30d: number; active_1d: number; active_7d: number; active_30d: number; dormant: number; leaderboard: number; push_devices: number };
  today: { submissions: number; approved: number };
  db: { bytes: number; limit_bytes: number; tables: { name: string; bytes: number; rows: number }[] };
};
type Daily = { day: string; families: number; members: number; new_families: number; active_1d: number; active_7d: number; active_30d: number; submissions_day: number; approved_day: number; push_devices: number; db_bytes: number };
type FamilyRow = { id: string; name: string; created_at: string; owner_email: string | null; status: Status; members: number; kids: number; last_active: string | null; subs_30d: number; push_devices: number; est_bytes: number };
type Status = "new" | "active" | "quiet" | "dormant";
type FamilyDetail = {
  family: { id: string; name: string; created_at: string; owner_email: string | null; golden_start: string; golden_end: string; daily_minutes: number; enforce_golden: boolean; limit_enabled: boolean; leaderboard: boolean };
  last_active: string | null; est_bytes: number;
  counts: Record<"members" | "kids" | "parents" | "tasks_active" | "tasks_total" | "rewards_active" | "challenges_active" | "submissions" | "approved" | "ledger" | "summaries" | "praises" | "push_devices", number>;
  activity_14d: { day: string; submissions: number; approved: number }[];
};
type AuditRow = { id: number; at: string; admin_email: string; action: string; family_id: string | null; detail: Record<string, unknown> };

/* ---------- Hằng số ước tính (xem docs/BAO-CAO-TONG-QUAN.md) ---------- */
const EGRESS_LIMIT = 5 * 1024 ** 3; // 5 GB mỗi tháng
const EGRESS_PER_ACTIVE_FAMILY = 52 * 1024 ** 2; // ~52 MB mỗi nhà hoạt động mỗi tháng
const REALTIME_LIMIT = 200;
const DEVICES_PER_FAMILY = 2.5;
const DB_PER_FAMILY_YEAR = 3.6 * 1024 ** 2; // ~3,6 MB mỗi nhà mỗi năm

/* ---------- Tiện ích ---------- */
const bytes = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.max(0, Math.round(n / 1024))} KB`);
const pctOf = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
const level = (p: number) => (p >= 90 ? "bad" : p >= 70 ? "warn" : "");
const dmy = (iso: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const dmyHm = (iso: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
function ago(iso: string | null): string {
  if (!iso) return "chưa có";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "vừa xong";
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
}
const STATUS_LABEL: Record<Status, string> = { new: "Mới", active: "Đang dùng", quiet: "Ít dùng", dormant: "Ngủ đông" };
const ACTION_LABEL: Record<string, string> = { view_family: "Xem chi tiết nhà", snapshot_now: "Chụp số liệu ngay" };

/** Gọi một hàm admin_* và giữ kết quả; tải lại khi `deps` đổi hoặc khi bấm "Thử lại" */
function useRpc<T>(fn: string, args: Record<string, unknown>, enabled = true) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  const [tick, setTick] = useState(0);
  const key = `${fn}|${JSON.stringify(args)}|${tick}`;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getSupabase().rpc(fn, args).then(({ data, error }) => {
      if (alive) setState({ key, data: error ? undefined : (data as T), error: error ? error.message : undefined });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  const ready = state.key === key;
  return { data: ready ? state.data : undefined, error: ready ? state.error : undefined, loading: enabled && !ready, reload: () => setTick((t) => t + 1) };
}

function Meter({ label, used, limit, text, estimate }: { label: string; used: number; limit: number; text: string; estimate?: boolean }) {
  const p = pctOf(used, limit);
  return (
    <div className={`ad-meter ${level(p)}`}>
      <div className="ad-meter-head"><span>{label}{estimate && <span className="ad-est">ước tính</span>}</span><span>{text} · {p}%</span></div>
      <div className="ad-meter-track" role="img" aria-label={`${label}: ${p}% của giới hạn`}><i className="ad-meter-fill" style={{ width: `${p}%` }} /></div>
    </div>
  );
}

function MiniBars({ values, labels, title }: { values: number[]; labels: [string, string]; title: string }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <h3>{title}</h3>
      <div className="ad-bars" role="img" aria-label={`${title}: ${values.join(", ")}`}>
        {values.map((v, i) => <i key={i} className={v ? "" : "zero"} style={{ height: `${Math.max(v ? 6 : 2, (v / max) * 100)}%` }} title={String(v)} />)}
      </div>
      <div className="ad-bars-lbl"><span>{labels[0]}</span><span>lớn nhất {max}</span><span>{labels[1]}</span></div>
    </div>
  );
}

/* ---------- Tổng quan ---------- */
function OverviewTab() {
  const ov = useRpc<Overview>("admin_overview", {});
  const series = useRpc<Daily[]>("admin_series", { p_days: 30 });
  const [busy, setBusy] = useState(false);
  const snap = useCallback(async () => {
    setBusy(true);
    await getSupabase().rpc("admin_snapshot_now");
    setBusy(false);
    series.reload(); ov.reload();
  }, [series, ov]);

  if (ov.error) return <div className="ad-card ad-err">Chưa tải được tổng quan: {ov.error} <button className="btn sm" onClick={ov.reload}>Thử lại</button></div>;
  const d = ov.data;
  if (!d) return <div className="ad-card ad-muted">Đang tải tổng quan...</div>;
  const t = d.totals;
  const free = Math.max(0, d.db.limit_bytes - d.db.bytes);
  const roomFamilies = Math.floor(free / DB_PER_FAMILY_YEAR);
  const egress = t.active_7d * EGRESS_PER_ACTIVE_FAMILY;
  const realtime = Math.round(t.active_1d * DEVICES_PER_FAMILY);
  const days = series.data ?? [];

  return (
    <div className="ad-stack">
      <div className="ad-grid ad-kpis">
        <div className="ad-card ad-kpi"><div className="n">{t.families}</div><div className="l">Gia đình</div><div className="s">{t.members} thành viên · {t.kids} bé</div></div>
        <div className="ad-card ad-kpi"><div className="n">{t.active_7d}</div><div className="l">Hoạt động 7 ngày</div><div className="s">1 ngày: {t.active_1d} · 30 ngày: {t.active_30d}</div></div>
        <div className="ad-card ad-kpi"><div className="n">{t.new_7d}</div><div className="l">Nhà mới 7 ngày</div><div className="s">30 ngày: {t.new_30d}</div></div>
        <div className="ad-card ad-kpi"><div className="n">{t.dormant}</div><div className="l">Ngủ đông</div><div className="s">quá 30 ngày không dùng</div></div>
        <div className="ad-card ad-kpi"><div className="n">{d.today.submissions}</div><div className="l">Việc nộp hôm nay</div><div className="s">đã gật đầu: {d.today.approved}</div></div>
        <div className="ad-card ad-kpi"><div className="n">{t.push_devices}</div><div className="l">Thiết bị nhận thông báo</div><div className="s">xếp hạng: {t.leaderboard} nhà tham gia</div></div>
      </div>

      <div className="ad-grid ad-two">
        <section className="ad-card" aria-label="Đồng hồ gói miễn phí">
          <h2>Đồng hồ gói miễn phí</h2>
          <Meter label="Dung lượng database (Supabase 500 MB)" used={d.db.bytes} limit={d.db.limit_bytes} text={`${bytes(d.db.bytes)} / ${bytes(d.db.limit_bytes)}`} />
          <Meter label="Băng thông tháng (Supabase 5 GB)" used={egress} limit={EGRESS_LIMIT} text={`${bytes(egress)} / ${bytes(EGRESS_LIMIT)}`} estimate />
          <Meter label="Kết nối realtime giờ cao điểm (tối đa 200)" used={realtime} limit={REALTIME_LIMIT} text={`${realtime} / ${REALTIME_LIMIT}`} estimate />
          <p className="ad-muted">Dung lượng còn lại {bytes(free)}, đủ thêm khoảng <b>{roomFamilies}</b> nhà dùng đều trong 1 năm (ước tính ~3,6 MB mỗi nhà mỗi năm). Băng thông và kết nối tính từ số nhà hoạt động: ~52 MB mỗi nhà mỗi tháng, ~2,5 thiết bị mỗi nhà. Số thật xem ở bảng điều khiển Supabase và Vercel.</p>
        </section>

        <section className="ad-card" aria-label="Bảng lớn nhất">
          <h2>Dữ liệu chiếm chỗ nhiều nhất</h2>
          <div className="ad-stack" style={{ gap: 8 }}>
            {d.db.tables.map((tb) => (
              <div key={tb.name} className="ad-meter" style={{ marginBottom: 0 }}>
                <div className="ad-meter-head"><span>{tb.name}</span><span>{bytes(tb.bytes)} · ~{Math.max(0, tb.rows)} dòng</span></div>
                <div className="ad-meter-track" style={{ height: 10 }}><i className="ad-meter-fill" style={{ width: `${pctOf(tb.bytes, d.db.tables[0]?.bytes || 1)}%`, background: "var(--purple)" }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="ad-card" aria-label="Xu hướng">
        <div className="ad-top" style={{ marginBottom: 6 }}>
          <h2 style={{ flex: 1, marginBottom: 0 }}>Xu hướng 30 ngày</h2>
          <button className="btn sm" onClick={snap} disabled={busy}>{busy ? "Đang chụp..." : "Chụp số liệu ngay"}</button>
        </div>
        {days.length < 2 ? (
          <div className="ad-note">Số liệu được chụp mỗi đêm lúc 21:00. Hiện mới có {days.length} ngày, biểu đồ sẽ đầy dần theo thời gian.</div>
        ) : (
          <div className="ad-grid ad-two">
            <MiniBars title="Số gia đình" values={days.map((x) => x.families)} labels={[dmy(days[0].day + "T00:00:00Z"), dmy(days[days.length - 1].day + "T00:00:00Z")]} />
            <MiniBars title="Nhà hoạt động trong ngày" values={days.map((x) => x.active_1d)} labels={[dmy(days[0].day + "T00:00:00Z"), dmy(days[days.length - 1].day + "T00:00:00Z")]} />
            <MiniBars title="Việc con nộp mỗi ngày" values={days.map((x) => x.submissions_day)} labels={[dmy(days[0].day + "T00:00:00Z"), dmy(days[days.length - 1].day + "T00:00:00Z")]} />
            <MiniBars title="Dung lượng database (MB)" values={days.map((x) => Math.round(x.db_bytes / 1024 ** 2))} labels={[dmy(days[0].day + "T00:00:00Z"), dmy(days[days.length - 1].day + "T00:00:00Z")]} />
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Gia đình ---------- */
const FILTERS: { v: "all" | Status; label: string }[] = [{ v: "all", label: "Tất cả" }, { v: "active", label: "Đang dùng" }, { v: "new", label: "Mới" }, { v: "quiet", label: "Ít dùng" }, { v: "dormant", label: "Ngủ đông" }];

function FamilyDetailCard({ id, onClose }: { id: string; onClose: () => void }) {
  const r = useRpc<FamilyDetail>("admin_family", { p_id: id });
  if (r.error) return <div className="ad-card ad-err">Không mở được chi tiết: {r.error}</div>;
  if (!r.data) return <div className="ad-card ad-muted">Đang tải chi tiết...</div>;
  const { family: f, counts: c } = r.data;
  const acts = r.data.activity_14d;
  return (
    <section className="ad-card ad-stack" aria-label={`Chi tiết ${f.name}`}>
      <div className="ad-top" style={{ marginBottom: 0 }}>
        <h2 style={{ flex: 1, marginBottom: 0 }}>{f.name}</h2>
        <button className="btn sm" onClick={onClose}>Đóng</button>
      </div>
      <div className="ad-note">Chỉ hiện số liệu. Tên con, tên việc và lời khen không hiển thị. Lần mở này đã được ghi vào nhật ký.</div>
      <dl className="ad-dl">
        <dt>Chủ nhà</dt><dd>{f.owner_email ?? "không rõ"}</dd>
        <dt>Tạo ngày</dt><dd>{dmy(f.created_at)}</dd>
        <dt>Hoạt động cuối</dt><dd>{ago(r.data.last_active)}</dd>
        <dt>Thành viên</dt><dd>{c.members} ({c.parents} bố mẹ, {c.kids} bé)</dd>
        <dt>Việc / phiếu / kèo</dt><dd>{c.tasks_active} việc đang dùng ({c.tasks_total} tổng) · {c.rewards_active} phiếu · {c.challenges_active} kèo</dd>
        <dt>Dữ liệu</dt><dd>{c.submissions} lượt việc ({c.approved} đã gật đầu) · {c.ledger} dòng sổ Ủn · {c.summaries} tổng kết ngày · {c.praises} lời khen</dd>
        <dt>Dung lượng ước tính</dt><dd>{bytes(r.data.est_bytes)}</dd>
        <dt>Thiết bị thông báo</dt><dd>{c.push_devices}</dd>
        <dt>Cài đặt</dt><dd>giờ vàng {f.golden_start.slice(0, 5)}–{f.golden_end.slice(0, 5)} · {f.limit_enabled ? `giới hạn ${f.daily_minutes} phút` : "không giới hạn phút"} · {f.enforce_golden ? "khoá ngoài giờ" : "không khoá ngoài giờ"} · {f.leaderboard ? "có tham gia xếp hạng" : "không xếp hạng"}</dd>
      </dl>
      <MiniBars title="Việc con nộp trong 14 ngày" values={acts.map((a) => a.submissions)} labels={[dmy(acts[0].day + "T00:00:00Z"), dmy(acts[acts.length - 1].day + "T00:00:00Z")]} />
    </section>
  );
}

function FamiliesTab() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [limit, setLimit] = useState(50);
  const [open, setOpen] = useState<string | null>(null);
  const list = useRpc<{ total: number; rows: FamilyRow[] }>("admin_families", { p_search: search, p_status: status, p_limit: limit, p_offset: 0 });

  return (
    <div className="ad-stack">
      <form className="ad-filters" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setLimit(50); }}>
        <input className="ad-input" type="search" aria-label="Tìm gia đình" placeholder="Tìm theo tên nhà hoặc email chủ nhà" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn sm" type="submit">Tìm</button>
        <div role="group" aria-label="Lọc trạng thái" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => <button key={f.v} type="button" className={`btn sm ${status === f.v ? "coin" : ""}`} aria-pressed={status === f.v} onClick={() => { setStatus(f.v); setLimit(50); }}>{f.label}</button>)}
        </div>
      </form>
      {list.error && <div className="ad-card ad-err">Chưa tải được danh sách: {list.error}</div>}
      {!list.data && !list.error && <div className="ad-card ad-muted">Đang tải danh sách...</div>}
      {list.data && (
        <div className="ad-grid ad-two" style={{ gridTemplateColumns: open ? "minmax(0, 1.5fr) minmax(0, 1fr)" : "1fr" }}>
          <div className="ad-card">
            <div className="ad-muted" style={{ marginBottom: 6 }}>{list.data.total} gia đình{search ? ` khớp "${search}"` : ""}</div>
            <div className="ad-scroll">
              <table className="ad-table">
                <thead><tr><th>Gia đình</th><th className="hide-s">Chủ nhà</th><th>Người</th><th>Hoạt động cuối</th><th className="hide-s">Việc 30 ngày</th><th className="hide-s">Dung lượng</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {list.data.rows.length === 0 && <tr><td colSpan={7} className="ad-muted">Không có gia đình nào.</td></tr>}
                  {list.data.rows.map((r) => (
                    <tr key={r.id} className={`ad-tr ${open === r.id ? "sel" : ""}`} tabIndex={0} aria-label={`Mở ${r.name}`} onClick={() => setOpen(r.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(r.id); }}>
                      <td><b>{r.name}</b><div className="ad-muted">tạo {dmy(r.created_at)}</div></td>
                      <td className="hide-s">{r.owner_email ?? "không rõ"}</td>
                      <td>{r.members} ({r.kids} bé)</td>
                      <td>{ago(r.last_active)}</td>
                      <td className="hide-s">{r.subs_30d}</td>
                      <td className="hide-s">{bytes(r.est_bytes)}</td>
                      <td><span className={`ad-pill ${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.data.total > list.data.rows.length && <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setLimit(limit + 50)}>Tải thêm</button>}
          </div>
          {open && <FamilyDetailCard key={open} id={open} onClose={() => setOpen(null)} />}
        </div>
      )}
    </div>
  );
}

/* ---------- Nhật ký ---------- */
function AuditTab() {
  const r = useRpc<AuditRow[]>("admin_audit_list", { p_limit: 100 });
  if (r.error) return <div className="ad-card ad-err">Chưa tải được nhật ký: {r.error}</div>;
  if (!r.data) return <div className="ad-card ad-muted">Đang tải nhật ký...</div>;
  return (
    <section className="ad-card" aria-label="Nhật ký admin">
      <h2>Nhật ký thao tác của admin</h2>
      <p className="ad-muted">Mọi lần xem chi tiết một nhà hoặc chụp số liệu đều được ghi lại. Nhật ký chỉ đọc, không sửa hay xoá được từ trang này.</p>
      <div className="ad-scroll">
        <table className="ad-table">
          <thead><tr><th>Lúc</th><th>Ai</th><th>Việc</th><th>Chi tiết</th></tr></thead>
          <tbody>
            {r.data.length === 0 && <tr><td colSpan={4} className="ad-muted">Chưa có thao tác nào.</td></tr>}
            {r.data.map((a) => (
              <tr key={a.id}>
                <td>{dmyHm(a.at)}</td><td>{a.admin_email}</td><td>{ACTION_LABEL[a.action] ?? a.action}</td>
                <td className="ad-muted">{typeof a.detail?.name === "string" ? a.detail.name : a.family_id ? a.family_id.slice(0, 8) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- Khung ---------- */
type Tab = "overview" | "families" | "audit";
const TABS: { v: Tab; label: string }[] = [{ v: "overview", label: "Tổng quan" }, { v: "families", label: "Gia đình" }, { v: "audit", label: "Nhật ký" }];

function Gate({ title, children }: { title: string; children?: React.ReactNode }) {
  return <main className="ad-center"><h1 className="display">{title}</h1>{children}</main>;
}

export function AdminApp() {
  const [auth, setAuth] = useState<"loading" | "out" | "in" | "off">(isSupabaseConfigured ? "loading" : "off");
  const [email, setEmail] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const role = useRpc<string | null>("admin_role", {}, auth === "in");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase().auth.getSession().then(({ data }) => {
      setAuth(data.session ? "in" : "out");
      setEmail(data.session?.user.email ?? "");
    });
  }, []);

  async function login() {
    await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/admin` } });
  }
  async function logout() {
    await getSupabase().auth.signOut();
    setEmail("");
    setAuth("out");
  }

  if (auth === "off") return <Gate title="Trang quản trị"><p className="ad-muted">Bản dùng thử không có trang quản trị. Cần kết nối Supabase.</p></Gate>;
  if (auth === "loading") return <Gate title="Đang kiểm tra..." />;
  if (auth === "out") {
    return <Gate title="Quản trị Ủn Ỉn"><p className="ad-muted">Đăng nhập bằng Gmail quản trị.</p><button className="btn big mint" onClick={login}>Đăng nhập với Google</button></Gate>;
  }
  if (role.loading) return <Gate title="Đang kiểm tra quyền..." />;
  if (role.error || !role.data) {
    return (
      <Gate title="Không có quyền quản trị">
        <p className="ad-muted">Tài khoản {email} không nằm trong danh sách quản trị.</p>
        <div className="row" style={{ justifyContent: "center", gap: 8 }}><Link className="btn sm" href="/">Về app</Link><button className="btn sm" onClick={logout}>Đổi tài khoản</button></div>
      </Gate>
    );
  }

  return (
    <div className="ad-wrap">
      <header className="ad-top">
        <h1 className="display">Quản trị Ủn Ỉn</h1>
        <span className="ad-badge">{role.data === "owner" ? "Chủ" : "Hỗ trợ"}</span>
        <span className="ad-muted">{email}</span>
        <Link className="btn sm" href="/">Về app</Link>
        <button className="btn sm" onClick={logout}>Thoát</button>
      </header>
      <div className="ad-tabs" role="tablist" aria-label="Mục quản trị">
        {TABS.map((t) => <button key={t.v} role="tab" aria-selected={tab === t.v} className={`btn sm ${tab === t.v ? "coin" : ""}`} onClick={() => setTab(t.v)}>{t.label}</button>)}
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "families" && <FamiliesTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}
