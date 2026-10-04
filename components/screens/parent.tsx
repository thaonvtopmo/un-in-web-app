"use client";

import { useState } from "react";
import { Coin } from "@/components/Coin";
import { Icon } from "@/components/Icon";
import { SLOT_SHORT, STICKERS, TIER_SHORT, assigneeLabel, kidPending, kidTasks, mem, myTasks, parentTasks, partnerLabel, repeatLabel, rewardOf, subOf, taskOf, timeInfo, today } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { Member, ParentTab, Who } from "@/lib/types";
import { Avatar } from "./common";
import { ChallengeForm, MemberEditForm, RewardForm, TaskForm, saveNewTask } from "./forms";
import { NotificationToggle } from "./notify";
import { MineTab } from "./mine";
import { PlanTab } from "./plan";
import { ChallengeCard, Jar } from "./kid";
import { WeeklyReport } from "./report";

const ask = (msg: string) => typeof window !== "undefined" && window.confirm(msg);

/* ---------- Gật đầu ---------- */
function Approve() {
  const { S, U, A } = useApp();
  const pend = kidPending(S);
  const me = U.member!;
  const doneToday = S.subs.filter((s) => s.status === "approved" && s.date === today() && mem(S, s.member).role === "kid");
  const checklist = parentTasks(S, today(), me);
  return (
    <div className="parent-grid">
      {kidTasks(S).length === 0 && (
        <div className="card" style={{ background: "var(--coin-soft)", gridColumn: "1 / -1" }}>
          <b>Hôm nay chưa giao việc nào cho con.</b> Vào tab <button className="pill" style={{ minHeight: 32 }} onClick={() => A.ptab("plan")}>Kế hoạch ngày</button> để chọn việc cho hôm nay.
        </div>
      )}
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
                  <div className="muted" style={{ fontSize: 12 }}>{k.name} · {s.time}{t.who === "together" ? ` · cùng ${partnerLabel(S, t)}` : ""}</div>
                </div>
                <b style={{ color: "#B45309" }}>+{t.coins}</b>
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {STICKERS.map((x, i) => (
                  <button key={x} className="pill" aria-pressed={x === cur} onClick={() => A.stick(s.id, i)}
                    style={{ borderColor: x === cur ? "var(--ink)" : "transparent", background: x === cur ? "var(--coin-soft)" : "var(--sand)", minHeight: 36 }}>
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
                <button className="btn sm" aria-label={`Hoàn tác gật đầu ${taskOf(S, s.task).title}`} title="Hoàn tác (bấm nhầm)"
                  onClick={() => { if (ask("Hoàn tác? Việc này sẽ quay lại chờ gật đầu và trừ lại Ủn đã cộng.")) void A.revoke(s.id); }}>
                  <Icon name="undo" size={15} strokeWidth={3} />
                </button>
              </div>
            ))}
          </>
        )}
      </section>
      <section className="stack">
        <h2>Con chấm cho {mem(S, me).name} hôm nay</h2>
        <div className="muted">Các con sẽ chấm trong giờ Ủn Ỉn</div>
        {myTasks(S, me).some((t) => t.selfCheck && !S.subs.some((s) => s.member === me && s.task === t.id && s.date === today() && s.status === "approved")) && (
          <button className="card row" style={{ background: "var(--coin-soft)" }} onClick={() => A.ptab("mine")}>
            <Icon name="check" size={20} strokeWidth={3} />
            <span className="grow"><b>Bạn còn việc riêng chưa xong hôm nay.</b> Mở &quot;Việc của tôi&quot;.</span>
          </button>
        )}
        {checklist.length === 0 && <div className="card">Chưa có mục nào. Thêm ở tab Việc tốt, chọn &quot;Bố mẹ (con chấm)&quot;.</div>}
        {checklist.map((t) => {
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
function PromiseNote({ id, value }: { id: string; value: string }) {
  const { A } = useApp();
  const [v, setV] = useState(value === "Bố mẹ sẽ hẹn ngày" ? "" : value);
  const [busy, setBusy] = useState(false);
  return (
    <form className="row" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); setBusy(true); await A.setPromiseNote(id, v); setBusy(false); }}>
      <input className="field" style={{ minHeight: 40 }} value={v} maxLength={40} placeholder="Hẹn ngày: Chủ nhật này..." aria-label="Ngày hẹn" onChange={(e) => setV(e.target.value)} />
      <button className="btn sm" type="submit" disabled={busy}>Lưu</button>
    </form>
  );
}

function Promises() {
  const { S, A } = useApp();
  const open = S.promises.filter((p) => p.status === "promised");
  const done = S.promises.filter((p) => p.status === "done");
  return (
    <div className="stack" style={{ maxWidth: 680 }}>
      <h2>Chờ giữ lời ({open.length})</h2>
      {open.length === 0 && <div className="card">Chưa có phiếu nào đang chờ. Khi con đổi phiếu, phiếu sẽ hiện ở đây.</div>}
      {open.map((p) => {
        const r = rewardOf(S, p.reward), k = mem(S, p.member);
        return (
          <div key={p.id} className="card stack" style={{ gap: 8 }}>
            <div className="row">
              <Icon name="ticket" size={24} />
              <div className="grow">
                <div className="display" style={{ fontSize: 15 }}>{r.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>{k.name} đổi</div>
              </div>
            </div>
            <PromiseNote id={p.id} value={p.at} />
            <div className="grid2">
              <button className="btn sm mint" onClick={() => A.promiseDone(p.id)}>Giữ lời rồi!</button>
              <button className="btn sm" onClick={() => { if (ask(`Huỷ phiếu "${r.title}"? Ủn sẽ được hoàn lại đủ cho ${k.name}.`)) void A.cancelPromise(p.id); }}>Huỷ phiếu</button>
            </div>
          </div>
        );
      })}
      {done.length > 0 && <h3 style={{ marginTop: 6 }}>Đã thực hiện ({done.length})</h3>}
      {done.map((p) => (
        <div key={p.id} className="card row" style={{ opacity: 0.7, boxShadow: "none", padding: "8px 10px" }}>
          <Icon name="check" size={18} strokeWidth={3.4} color="#0F766E" />
          <span className="grow" style={{ fontSize: 14 }}>{rewardOf(S, p.reward).title} · {mem(S, p.member).name}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Việc tốt ---------- */
const WHO_LABEL: Record<Who, string> = { kid: "Việc tốt của các con", together: "Làm cùng nhau", parent: "Checklist của bố mẹ (con chấm)" };

function Tasks() {
  const { S, A } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="parent-grid">
      <TaskForm members={S.members} onSave={(v, o) => saveNewTask(A, v, o)} />
      <section className="stack" style={{ gap: 8 }}>
        <div className="muted">Đây là kho việc. Chọn việc nào làm vào ngày nào ở tab &quot;Kế hoạch ngày&quot;; cột lặp lại cho biết việc tự hiện vào những thứ nào.</div>
        {(["together", "kid", "parent"] as Who[]).map((w) => (
          <div key={w} className="stack" style={{ gap: 8 }}>
            <h3>{WHO_LABEL[w]}</h3>
            {S.tasks.filter((t) => t.who === w && !t.oneOff).length === 0 && <div className="muted">Chưa có mục nào.</div>}
            {S.tasks.filter((t) => t.who === w && !t.oneOff).map((t) => editing === t.id ? (
              <TaskForm key={t.id} initial={t} members={S.members} onSave={(v) => A.updateTask(t.id, v)} onCancel={() => setEditing(null)} />
            ) : (
              <div key={t.id} className="card row" style={{ padding: "6px 10px" }}>
                <div className="icon-box" style={{ width: 34, height: 34, background: t.bg }}><Icon name={t.icon} size={18} /></div>
                <div className="grow">
                  <b style={{ fontSize: 14 }}>{t.title}</b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {SLOT_SHORT[t.slot]}{t.selfCheck ? " · tự đánh dấu" : ` · +${t.coins} Ủn`} · {repeatLabel(t.repeat)}
                    {timeInfo(t) ? ` · ${timeInfo(t)}` : ""}{` · giao ${assigneeLabel(S, t)}`}
                  </div>
                </div>
                <button className="btn sm" onClick={() => setEditing(t.id)} aria-label={`Sửa ${t.title}`}><Icon name="pencil" size={16} /></button>
                <button className="btn sm" onClick={() => { if (ask(`Xoá "${t.title}"? Lịch sử cũ vẫn được giữ.`)) void A.delTask(t.id); }} aria-label={`Xoá ${t.title}`}><Icon name="trash" size={16} /></button>
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
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="parent-grid">
      <RewardForm onSave={(v) => A.addReward(v)} />
      <section className="stack" style={{ gap: 8 }}>
        {S.rewards.length === 0 && <div className="card">Chưa có phiếu nào. Thêm phiếu đầu tiên bên cạnh nhé.</div>}
        {S.rewards.map((r) => editing === r.id ? (
          <RewardForm key={r.id} initial={r} onSave={(v) => A.updateReward(r.id, v)} onCancel={() => setEditing(null)} />
        ) : (
          <div key={r.id} className="card row" style={{ padding: "6px 10px" }}>
            <div className="icon-box" style={{ width: 34, height: 34, background: r.bg }}><Icon name={r.icon} size={18} /></div>
            <div className="grow">
              <b style={{ fontSize: 14 }}>{r.title}</b>
              <div className="muted" style={{ fontSize: 12 }}>Phiếu {TIER_SHORT[r.tier].toLowerCase()} · {r.cost} Ủn</div>
            </div>
            <button className="btn sm" onClick={() => setEditing(r.id)} aria-label={`Sửa ${r.title}`}><Icon name="pencil" size={16} /></button>
            <button className="btn sm" onClick={() => { if (ask(`Xoá phiếu "${r.title}"?`)) void A.delReward(r.id); }} aria-label={`Xoá ${r.title}`}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------- Kèo cả nhà ---------- */
function Challenges() {
  const { S, A } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="parent-grid">
      <section className="stack">
        {S.challenges.length === 0 && <div className="card">Chưa có kèo nào. Lên kèo bên cạnh để cả nhà cùng thi nhé.</div>}
        {S.challenges.map((c) => (
          <div key={c.id} className="stack" style={{ gap: 8 }}>
            {editing === c.id ? (
              <ChallengeForm initial={c} members={S.members} tasks={S.tasks} onSave={(v) => A.updateChal(c.id, v)} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <ChallengeCard c={c} />
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {[c.a, c.b].map((id) => (
                    <span key={id} className="row" style={{ gap: 4 }}>
                      <button className="btn sm" onClick={() => A.chal(c.id, id, 1)} aria-label={`Cộng 1 cho ${mem(S, id).name}`}>+1 {mem(S, id).name}</button>
                      <button className="btn sm" onClick={() => A.chal(c.id, id, -1)} aria-label={`Trừ 1 của ${mem(S, id).name}`}>−1</button>
                    </span>
                  ))}
                  <button className="btn sm" onClick={() => setEditing(c.id)}><Icon name="pencil" size={15} />Sửa</button>
                  <button className="btn sm ghost" onClick={() => { if (ask(`Kết thúc kèo "${c.title}"?`)) void A.delChal(c.id); }}>Kết thúc</button>
                </div>
              </>
            )}
          </div>
        ))}
      </section>
      <ChallengeForm members={S.members} tasks={S.tasks} onSave={(v) => A.addChal(v)} />
    </div>
  );
}

/* ---------- Thành viên ---------- */
function Members() {
  const { S, A } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"kid" | "parent">("kid");
  const [busy, setBusy] = useState(false);
  const parents = S.members.filter((m) => m.role === "parent");
  const kids = S.members.filter((m) => m.role === "kid");

  const group = (title: string, list: Member[]) => (
    <div className="stack" style={{ gap: 8 }}>
      <h3>{title} ({list.length})</h3>
      {list.map((m) => editing === m.id ? (
        <MemberEditForm key={m.id} member={m} onSave={(v) => A.updateMember(m.id, v)} onCancel={() => setEditing(null)} />
      ) : (
        <div key={m.id} className="card row" style={{ padding: "6px 10px" }}>
          <Avatar m={m} size={36} fs={14} />
          <b className="grow">{m.name}</b>
          <button className="btn sm" onClick={() => setEditing(m.id)} aria-label={`Sửa ${m.name}`}><Icon name="pencil" size={16} /></button>
          <button className="btn sm" disabled={m.role === "parent" && parents.length <= 1}
            title={m.role === "parent" && parents.length <= 1 ? "Cần giữ ít nhất 1 người lớn" : undefined}
            aria-label={`Xoá ${m.name}`}
            onClick={() => { if (ask(`Xoá ${m.name}? Ủn và lịch sử của ${m.name} sẽ mất, không khôi phục được.`)) void A.removeMember(m.id); }}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="parent-grid">
      <form className="card stack" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await A.addMember({ name, role });
        setBusy(false);
        if (ok) setName("");
      }}>
        <h3>Thêm thành viên</h3>
        <div className="muted">Các con không cần Gmail riêng. Cả nhà dùng chung 1 tài khoản.</div>
        <label className="lbl">Tên<input className="field" name="name" value={name} maxLength={20} placeholder="Ví dụ: Bin" onChange={(e) => setName(e.target.value)} /></label>
        <label className="lbl">Vai trò
          <select className="field" name="role" value={role} onChange={(e) => setRole(e.target.value as "kid" | "parent")}>
            <option value="kid">Con</option><option value="parent">Bố / Mẹ</option>
          </select>
        </label>
        <button className="btn mint" type="submit" disabled={busy}><Icon name="plus" size={18} strokeWidth={3} />Thêm thành viên</button>
      </form>
      <section className="stack">{group("Bố mẹ", parents)}{group("Các con", kids)}</section>
    </div>
  );
}

/* ---------- Cài đặt ---------- */
function SettingsTab() {
  const { S, A, demo, signOut } = useApp();
  const st = S.settings;
  const [busy, setBusy] = useState(false);
  return (
    <form
      key={JSON.stringify([st, S.familyName, S.jar.goal, S.jar.target])}
      className="card stack"
      style={{ maxWidth: 560 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const s = (k: string) => String(fd.get(k) ?? "");
        setBusy(true);
        await A.saveSettings({
          familyName: s("familyName"), leaderboard: fd.get("leaderboard") === "on", oldPin: s("oldPin"), newPin: s("newPin"),
          start: s("start"), end: s("end"), minutes: Number(s("minutes")), enforce: fd.get("enforce") === "on", limitEnabled: fd.get("limitEnabled") === "on",
          goal: s("goal"), target: Number(s("target")),
        });
        setBusy(false);
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
      <label className="lbl check"><input type="checkbox" name="limitEnabled" defaultChecked={st.limitEnabled} />Giới hạn số phút chơi mỗi ngày (đang {st.limitEnabled ? "bật" : "tắt: con chơi không bị tính giờ"})</label>
      <label className="lbl">Số phút chơi mỗi ngày (khi bật giới hạn)<input className="field" type="number" name="minutes" min={1} max={60} defaultValue={st.minutes} /></label>
      <label className="lbl check"><input type="checkbox" name="enforce" defaultChecked={st.enforce} />Khoá app ngoài giờ Ủn Ỉn (con chỉ thấy &quot;Ủn đang ngủ rồi!&quot;)</label>
      <h3 style={{ marginTop: 6 }}>Hũ Mơ Ước</h3>
      <div className="grid2">
        <label className="lbl">Mục tiêu<input className="field" name="goal" maxLength={40} defaultValue={S.jar.goal} /></label>
        <label className="lbl">Số Ủn cần<input className="field" type="number" name="target" min={50} max={10000} defaultValue={S.jar.target} /></label>
      </div>
      {S.jar.reached && <div className="muted">Hũ hiện tại đã đầy. Đổi mục tiêu hoặc số Ủn để mở hũ mới.</div>}
      <NotificationToggle />
      <h3 style={{ marginTop: 6 }}>Bảo mật</h3>
      <div className="grid2">
        <label className="lbl">PIN hiện tại<input className="field" name="oldPin" type="password" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="Chỉ khi đổi PIN" /></label>
        <label className="lbl">PIN mới (4 số)<input className="field" name="newPin" type="password" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="Để trống nếu giữ nguyên" /></label>
      </div>
      <button className="btn mint" type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Lưu cài đặt"}</button>
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
  const waiting = S.promises.filter((p) => p.status === "promised").length;
  const tabs: [ParentTab, string][] = [
    ["approve", "Gật đầu" + (n ? ` (${n})` : "")], ["mine", "Việc của tôi"], ["plan", "Kế hoạch ngày"], ["jar", "Hũ chung"], ["promises", "Ngoéo tay" + (waiting ? ` (${waiting})` : "")], ["report", "Báo cáo tuần"],
    ["tasks", "Việc tốt"], ["rewards", "Phiếu đi chơi"], ["challenges", "Kèo cả nhà"], ["members", "Thành viên"], ["settings", "Cài đặt"],
  ];
  const views: Record<ParentTab, () => React.ReactNode> = {
    approve: Approve, mine: MineTab, plan: PlanTab, jar: Jar, promises: Promises, report: WeeklyReport, tasks: Tasks, rewards: Rewards, challenges: Challenges, members: Members, settings: SettingsTab,
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
