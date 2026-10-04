"use client";

import type { FormEvent } from "react";
import { Coin } from "@/components/Coin";
import { ICON_LABEL, REWARD_ICONS, TASK_ICONS, Icon, type IconName } from "@/components/Icon";
import { SLOTS, STICKERS, TIERS, jarTotal, kidPending, mem, parentTasks, rewardOf, subOf, taskOf, today } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { ParentTab, Slot, Tier, Who } from "@/lib/types";
import { Avatar } from "./common";
import { ChallengeCard, } from "./kid";
import { FamilyLeaderboard } from "./leaderboard";

const opt = (v: string, l: string) => <option key={v} value={v}>{l}</option>;

/** Đọc form, gọi hàm xử lý rồi xoá ô nhập */
function onForm(handler: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handler(new FormData(e.currentTarget));
    e.currentTarget.reset();
  };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const num = (fd: FormData, k: string) => Number(fd.get(k)) || 0;

/* ---------- Gật đầu ---------- */
function Approve() {
  const { S, U, A } = useApp();
  const pend = kidPending(S);
  const me = U.member!;
  const doneToday = S.subs.filter((s) => s.status === "approved" && s.date === today() && mem(S, s.member).role === "kid");
  return (
    <div className="parent-grid">
      <section className="stack">
        <h2>Chờ gật đầu</h2>
        {pend.length ? pend.map((s) => {
          const t = taskOf(S, s.task), k = mem(S, s.member), cur = U.sticker[s.id] || STICKERS[0];
          return (
            <div key={s.id} className="card stack" style={{ gap: 8 }}>
              <div className="row">
                <Avatar m={k} size={34} fs={14} />
                <div className="grow">
                  <div className="display" style={{ fontSize: 15 }}>{t.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{k.name} · {s.time}</div>
                </div>
                <b style={{ color: "#B45309" }}>+{t.coins}</b>
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {STICKERS.map((x, i) => (
                  <button key={x} className="pill" aria-pressed={x === cur} onClick={() => A.stick(s.id, i)}
                    style={{ borderColor: x === cur ? "var(--ink)" : "transparent", background: x === cur ? "var(--coin-soft)" : "var(--sand)", minHeight: 32 }}>
                    {x}
                  </button>
                ))}
              </div>
              <div className="grid2">
                <button className="btn sm mint" onClick={() => A.approve(s.id)}>Gật đầu</button>
                <button className="btn sm" onClick={() => A.remind(s.id)}>Nhắc nhẹ</button>
              </div>
            </div>
          );
        }) : <div className="card">Không còn gì chờ gật đầu.</div>}
        {doneToday.length > 0 && (
          <>
            <h3 style={{ marginTop: 6 }}>Đã gật đầu hôm nay</h3>
            {doneToday.map((s) => (
              <div key={s.id} className="row" style={{ fontSize: 13 }}>
                <Icon name="check" size={16} strokeWidth={3.4} color="#0F766E" />
                <span className="grow">{mem(S, s.member).name} · {taskOf(S, s.task).title}</span>
                <b>+{taskOf(S, s.task).coins}</b>
              </div>
            ))}
          </>
        )}
      </section>
      <section className="stack">
        <h2>Checklist của {mem(S, me).name} hôm nay</h2>
        <div className="muted">Các con sẽ chấm cho bạn trong giờ Ủn Ỉn</div>
        {parentTasks(S).map((t) => {
          const ok = subOf(S, me, t.id)?.status === "approved";
          return (
            <div key={t.id} className="card row" style={{ padding: "8px 10px" }}>
              <div className="icon-box" style={{ width: 36, height: 36, background: t.bg }}><Icon name={t.icon} size={20} /></div>
              <div className="grow">
                <b style={{ fontSize: 14 }}>{t.title}</b>
                <div style={{ fontSize: 12, color: "#B45309", fontWeight: 900 }}>+{t.coins} Ủn</div>
              </div>
              {ok
                ? <span className="pill" style={{ background: "var(--mint-soft)" }}><Icon name="check" size={13} strokeWidth={3.4} />Con chấm đạt</span>
                : <span className="pill" style={{ background: "var(--sand)" }}>Chờ con chấm</span>}
            </div>
          );
        })}
        <div className="card row" style={{ background: "var(--coin-soft)" }}>
          <Coin size={26} /><b className="grow">Ủn của {mem(S, me).name}</b>
          <span className="display" style={{ fontSize: 20 }}>{S.coins[me]}</span>
        </div>
      </section>
    </div>
  );
}

/* ---------- Ngoéo tay ---------- */
function Promises() {
  const { S, A } = useApp();
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      {S.promises.length ? S.promises.map((p) => {
        const r = rewardOf(S, p.reward), k = mem(S, p.member), done = p.status === "done";
        return (
          <div key={p.id} className="card row" style={done ? { opacity: 0.6, boxShadow: "none" } : undefined}>
            <Icon name="ticket" size={24} />
            <div className="grow">
              <div className="display" style={{ fontSize: 15 }}>{r.title}</div>
              <div className="muted" style={{ fontSize: 12 }}>{k.name} đổi · {p.at}</div>
            </div>
            {done
              ? <span className="pill" style={{ background: "var(--mint-soft)" }}>Đã thực hiện</span>
              : <button className="btn sm mint" onClick={() => A.promiseDone(p.id)}>Giữ lời rồi!</button>}
          </div>
        );
      }) : <div className="card">Chưa ngoéo tay phiếu nào.</div>}
    </div>
  );
}

/* ---------- Báo cáo tuần ---------- */
function Report() {
  const { S } = useApp();
  const ap = S.subs.filter((s) => s.date === today() && s.status === "approved" && mem(S, s.member).role === "kid").length;
  const pct = Math.min(100, Math.round((jarTotal(S) / S.jar.target) * 100));
  return (
    <div className="parent-grid">
      <div className="card" style={{ overflowX: "auto" }}>
        <h3 style={{ marginBottom: 8 }}>Ủn theo tuần</h3>
        <table className="tbl">
          <thead><tr><th>Thành viên</th><th>Tuần này</th><th>Tuần trước</th><th>Chênh lệch</th><th>Đang có</th></tr></thead>
          <tbody>
            {S.members.map((m) => {
              const w = S.week[m.id] || 0, l = S.lastWeek[m.id] || 0;
              return (
                <tr key={m.id}>
                  <td>{m.name}</td><td>{w}</td><td>{l}</td>
                  <td style={{ color: w - l >= 0 ? "#0F766E" : "#C2185B" }}>{w - l >= 0 ? "+" : ""}{w - l}</td>
                  <td>{S.coins[m.id]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="stack">
        <div className="card"><div className="muted">Việc tốt của các con được gật đầu hôm nay</div><div className="display" style={{ fontSize: 32 }}>{ap}</div></div>
        <div className="card">
          <div className="muted">Hũ Mơ Ước · {S.jar.goal}</div>
          <div className="display" style={{ fontSize: 22 }}>{jarTotal(S)}/{S.jar.target} Ủn</div>
          <div className="bar" style={{ marginTop: 8 }}><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="card"><div className="muted">Lời ngoéo tay chưa thực hiện</div><div className="display" style={{ fontSize: 32 }}>{S.promises.filter((p) => p.status === "promised").length}</div></div>
      </div>
      <FamilyLeaderboard />
    </div>
  );
}

/* ---------- Việc tốt ---------- */
const WHO_LABEL: Record<Who, string> = { kid: "Việc tốt của các con", together: "Làm cùng nhau", parent: "Việc tốt của bố mẹ" };

function Tasks() {
  const { S, A } = useApp();
  return (
    <div className="parent-grid">
      <form className="card stack" onSubmit={onForm((fd) => A.addTask({ title: str(fd, "title"), coins: num(fd, "coins"), slot: str(fd, "slot") as Slot, who: str(fd, "who") as Who, icon: str(fd, "icon") as IconName }))}>
        <h3>Thêm việc tốt</h3>
        <label className="lbl">Tên việc tốt<input className="field" name="title" required maxLength={40} placeholder="Ví dụ: Tự đánh răng" /></label>
        <div className="grid2">
          <label className="lbl">Số Ủn<input className="field" name="coins" type="number" min={1} max={200} defaultValue={10} required /></label>
          <label className="lbl">Buổi<select className="field" name="slot">{opt("sang", "Sáng")}{opt("chieu", "Chiều")}{opt("toi", "Tối")}</select></label>
        </div>
        <div className="grid2">
          <label className="lbl">Dành cho<select className="field" name="who">{opt("kid", "Các con")}{opt("together", "Con làm cùng bố mẹ")}{opt("parent", "Bố mẹ")}</select></label>
          <label className="lbl">Biểu tượng<select className="field" name="icon">{TASK_ICONS.map((i) => opt(i, ICON_LABEL[i] ?? i))}</select></label>
        </div>
        <button className="btn mint" type="submit"><Icon name="plus" size={18} strokeWidth={3} />Thêm việc tốt</button>
      </form>
      <section className="stack" style={{ gap: 8 }}>
        {(["together", "kid", "parent"] as Who[]).map((w) => (
          <div key={w} className="stack" style={{ gap: 8 }}>
            <h3>{WHO_LABEL[w]}</h3>
            {S.tasks.filter((t) => t.who === w).map((t) => (
              <div key={t.id} className="card row" style={{ padding: "6px 10px" }}>
                <div className="icon-box" style={{ width: 34, height: 34, background: t.bg }}><Icon name={t.icon} size={18} /></div>
                <div className="grow">
                  <b style={{ fontSize: 14 }}>{t.title}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{SLOTS[t.slot].label.toLowerCase()} · +{t.coins} Ủn</div>
                </div>
                <button className="btn sm" onClick={() => A.delTask(t.id)} aria-label={`Xoá ${t.title}`}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------- Phiếu đi chơi ---------- */
function Rewards() {
  const { S, A } = useApp();
  return (
    <div className="parent-grid">
      <form className="card stack" onSubmit={onForm((fd) => A.addReward({ title: str(fd, "title"), cost: num(fd, "cost"), tier: str(fd, "tier") as Tier, icon: str(fd, "icon") as IconName }))}>
        <h3>Thêm phiếu đi chơi</h3>
        <label className="lbl">Tên phiếu<input className="field" name="title" required maxLength={40} placeholder="Ví dụ: Đi bơi cùng bố" /></label>
        <div className="grid2">
          <label className="lbl">Giá (Ủn)<input className="field" name="cost" type="number" min={1} max={5000} defaultValue={100} required /></label>
          <label className="lbl">Tầng<select className="field" name="tier">{opt("nho", "Nhỏ")}{opt("vua", "Vừa")}{opt("lon", "Lớn")}</select></label>
        </div>
        <label className="lbl">Biểu tượng<select className="field" name="icon">{REWARD_ICONS.map((i) => opt(i, ICON_LABEL[i] ?? i))}</select></label>
        <button className="btn mint" type="submit"><Icon name="plus" size={18} strokeWidth={3} />Thêm phiếu đi chơi</button>
      </form>
      <section className="stack" style={{ gap: 8 }}>
        {S.rewards.map((r) => (
          <div key={r.id} className="card row" style={{ padding: "6px 10px" }}>
            <div className="icon-box" style={{ width: 34, height: 34, background: r.bg }}><Icon name={r.icon} size={18} /></div>
            <div className="grow">
              <b style={{ fontSize: 14 }}>{r.title}</b>
              <div className="muted" style={{ fontSize: 12 }}>{TIERS[r.tier].label.split(" ·")[0].toLowerCase()} · {r.cost} Ủn</div>
            </div>
            <button className="btn sm" onClick={() => A.delReward(r.id)} aria-label={`Xoá ${r.title}`}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------- Kèo cả nhà ---------- */
function Challenges() {
  const { S, A } = useApp();
  return (
    <div className="parent-grid">
      <section className="stack">
        {S.challenges.length ? S.challenges.map((c) => (
          <div key={c.id} className="stack" style={{ gap: 8 }}>
            <ChallengeCard c={c} />
            <div className="row" style={{ flexWrap: "wrap" }}>
              {[c.a, c.b].map((id) => <button key={id} className="btn sm" onClick={() => A.chal(c.id, id)}>+1 cho {mem(S, id).name}</button>)}
              <button className="btn sm ghost" onClick={() => A.delChal(c.id)}>Kết thúc</button>
            </div>
          </div>
        )) : <div className="card">Chưa có kèo nào.</div>}
      </section>
      <form className="card stack" onSubmit={onForm((fd) => A.addChal({ a: str(fd, "a"), b: str(fd, "b"), title: str(fd, "title"), target: num(fd, "target"), prize: str(fd, "prize"), linkedTask: str(fd, "linkedTask") || undefined }))}>
        <h3>Lên kèo mới</h3>
        <label className="lbl">Thử thách<input className="field" name="title" required maxLength={60} placeholder="Ví dụ: Ai dậy trước 6h30 đủ 5 ngày?" /></label>
        <div className="grid2">
          <label className="lbl">Người 1<select className="field" name="a" defaultValue={S.members.find((m) => m.role === "parent")?.id}>{S.members.map((m) => opt(m.id, m.name))}</select></label>
          <label className="lbl">Người 2<select className="field" name="b" defaultValue={S.members.find((m) => m.role === "kid")?.id}>{S.members.map((m) => opt(m.id, m.name))}</select></label>
        </div>
        <div className="grid2">
          <label className="lbl">Số ngày cần đạt<input className="field" name="target" type="number" min={1} max={14} defaultValue={5} /></label>
          <label className="lbl">Phần thưởng<input className="field" name="prize" maxLength={60} placeholder="Chọn phim tối thứ Bảy" /></label>
        </div>
        <label className="lbl">Tự +1 khi việc tốt này được gật đầu (không bắt buộc)
          <select className="field" name="linkedTask" defaultValue="">{opt("", "Không, bố mẹ tự +1")}{S.tasks.filter((t) => t.who !== "parent").map((t) => opt(t.id, t.title))}</select>
        </label>
        <button className="btn mint" type="submit"><Icon name="plus" size={18} strokeWidth={3} />Lên kèo</button>
      </form>
    </div>
  );
}

/* ---------- Thành viên ---------- */
function Members() {
  const { S, A } = useApp();
  const parents = S.members.filter((m) => m.role === "parent");
  const kids = S.members.filter((m) => m.role === "kid");
  const group = (title: string, list: typeof S.members) => (
    <div className="stack" style={{ gap: 8 }}>
      <h3>{title} ({list.length})</h3>
      {list.map((m) => (
        <div key={m.id} className="card row" style={{ padding: "6px 10px" }}>
          <Avatar m={m} size={36} fs={14} />
          <b className="grow">{m.name}</b>
          <button
            className="btn sm"
            disabled={m.role === "parent" && parents.length <= 1}
            aria-label={`Xoá ${m.name}`}
            onClick={() => { if (window.confirm(`Xoá ${m.name}? Ủn và lịch sử của ${m.name} sẽ mất.`)) A.removeMember(m.id); }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
  return (
    <div className="parent-grid">
      <form className="card stack" onSubmit={onForm((fd) => A.addMember({ name: str(fd, "name"), role: str(fd, "role") as "parent" | "kid" }))}>
        <h3>Thêm thành viên</h3>
        <div className="muted">Các con không cần Gmail riêng. Cả nhà dùng chung 1 tài khoản.</div>
        <label className="lbl">Tên<input className="field" name="name" required maxLength={20} placeholder="Ví dụ: Bin" /></label>
        <label className="lbl">Vai trò<select className="field" name="role" defaultValue="kid">{opt("kid", "Con")}{opt("parent", "Bố / Mẹ")}</select></label>
        <button className="btn mint" type="submit"><Icon name="plus" size={18} strokeWidth={3} />Thêm thành viên</button>
      </form>
      <section className="stack">{group("Bố mẹ", parents)}{group("Các con", kids)}</section>
    </div>
  );
}

/* ---------- Cài đặt ---------- */
function SettingsTab() {
  const { S, A, demo, signOut } = useApp();
  const st = S.settings;
  return (
    <form
      key={JSON.stringify([st, S.familyName, S.jar.goal, S.jar.target])}
      className="card stack"
      style={{ maxWidth: 560 }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        A.saveSettings({
          familyName: str(fd, "familyName"), leaderboard: fd.get("leaderboard") === "on", oldPin: str(fd, "oldPin"), newPin: str(fd, "newPin"), start: str(fd, "start"), end: str(fd, "end"), minutes: num(fd, "minutes"),
          enforce: fd.get("enforce") === "on", goal: str(fd, "goal"), target: num(fd, "target"),
        });
      }}
    >
      <h3>Gia đình</h3>
      <label className="lbl">Tên gia đình<input className="field" name="familyName" maxLength={40} defaultValue={S.familyName} placeholder="Ví dụ: Nhà Gấu Bông" /></label>
      <label className="lbl check" style={{ alignItems: "flex-start" }}><input type="checkbox" name="leaderboard" defaultChecked={st.leaderboard} /><span>Tham gia bảng xếp hạng các nhà (chỉ hiện tên gia đình và Ủn trung bình, không hiện tên bé)</span></label>
      <h3 style={{ marginTop: 6 }}>Giờ Ủn Ỉn &amp; giới hạn</h3>
      <div className="grid2">
        <label className="lbl">Mở app từ<input className="field" type="time" name="start" defaultValue={st.start} /></label>
        <label className="lbl">Đến<input className="field" type="time" name="end" defaultValue={st.end} /></label>
      </div>
      <label className="lbl">Số phút chơi mỗi lần<input className="field" type="number" name="minutes" min={1} max={60} defaultValue={st.minutes} /></label>
      <label className="lbl check"><input type="checkbox" name="enforce" defaultChecked={st.enforce} />Khoá app ngoài giờ Ủn Ỉn (bật để thử màn &quot;Ủn đang ngủ&quot;)</label>
      <h3 style={{ marginTop: 6 }}>Hũ Mơ Ước</h3>
      <div className="grid2">
        <label className="lbl">Mục tiêu<input className="field" name="goal" maxLength={40} defaultValue={S.jar.goal} /></label>
        <label className="lbl">Số Ủn cần<input className="field" type="number" name="target" min={50} max={10000} defaultValue={S.jar.target} /></label>
      </div>
      <h3 style={{ marginTop: 6 }}>Bảo mật</h3>
      <div className="grid2">
        <label className="lbl">PIN hiện tại<input className="field" name="oldPin" type="password" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="Chỉ khi đổi PIN" /></label>
        <label className="lbl">PIN mới (4 số)<input className="field" name="newPin" type="password" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="Để trống nếu giữ nguyên" /></label>
      </div>
      <button className="btn mint" type="submit">Lưu cài đặt</button>
      {!demo && (
        <button className="btn ghost" type="button" onClick={signOut}>Đăng xuất tài khoản Gmail</button>
      )}
    </form>
  );
}

/* ---------- Khung của bố mẹ ---------- */
export function ParentShell() {
  const { S, U, A } = useApp();
  const m = mem(S, U.member!);
  const n = kidPending(S).length;
  const tabs: [ParentTab, string][] = [
    ["approve", "Gật đầu" + (n ? ` (${n})` : "")], ["promises", "Ngoéo tay"], ["report", "Báo cáo tuần"],
    ["tasks", "Việc tốt"], ["rewards", "Phiếu đi chơi"], ["challenges", "Kèo cả nhà"], ["members", "Thành viên"], ["settings", "Cài đặt"],
  ];
  const views: Record<ParentTab, () => React.ReactNode> = {
    approve: Approve, promises: Promises, report: Report, tasks: Tasks, rewards: Rewards, challenges: Challenges, members: Members, settings: SettingsTab,
  };
  const View = views[U.ptab];
  return (
    <main className="app wide">
      <header className="row">
        <Avatar m={m} size={44} fs={18} />
        <div className="grow">
          <h1 style={{ fontSize: 22 }}>Góc bố mẹ</h1>
          <div className="muted">Gật đầu nhanh, khen thật cụ thể nhé</div>
        </div>
        <button className="btn sm" onClick={A.logout}>Thoát</button>
      </header>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} className={`btn sm ${U.ptab === k ? "coin" : ""}`} role="tab" aria-selected={U.ptab === k} onClick={() => A.ptab(k)}>{l}</button>
        ))}
      </div>
      <View />
    </main>
  );
}
