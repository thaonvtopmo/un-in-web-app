"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Icon, ICON_LABEL, REWARD_ICONS, TASK_ICONS, type IconName } from "@/components/Icon";
import { KID_COLORS, PARENT_COLORS, type ChallengeInput, type RewardInput, type TaskInput } from "@/lib/backend";
import { Avatar } from "./common";
import { AVATARS, DOW_SHORT, REPEAT_ALL, REPEAT_WEEKDAYS, REPEAT_WEEKEND, SLOTS, SLOT_SHORT, TIERS, TIER_SHORT } from "@/lib/data";
import type { Challenge, Member, Reward, Slot, Task, Tier, Who } from "@/lib/types";

/** Biểu tượng chọn bằng cách bấm, dễ hơn danh sách thả xuống */
export function IconPicker({ icons, value, onChange }: { icons: IconName[]; value: IconName; onChange: (i: IconName) => void }) {
  return (
    <div role="radiogroup" aria-label="Biểu tượng" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {icons.map((i) => (
        <button
          key={i} type="button" role="radio" aria-checked={i === value} aria-label={ICON_LABEL[i] ?? i} title={ICON_LABEL[i] ?? i}
          onClick={() => onChange(i)}
          style={{
            width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            border: `2.5px solid ${i === value ? "var(--ink)" : "var(--sand)"}`, background: i === value ? "var(--coin-soft)" : "#fff",
          }}
        >
          <Icon name={i} size={22} />
        </button>
      ))}
    </div>
  );
}

function FormShell({ title, onSubmit, children, error, busy, submitLabel, onCancel }: {
  title?: string; onSubmit: (e: FormEvent) => void; children: ReactNode; error: string; busy: boolean; submitLabel: string; onCancel?: () => void;
}) {
  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      {title && <h3>{title}</h3>}
      {children}
      {error && <div role="alert" style={{ color: "#C2185B", fontWeight: 800, fontSize: 13 }}>{error}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn mint grow" type="submit" disabled={busy}>
          {onCancel ? <Icon name="check" size={18} strokeWidth={3.4} /> : <Icon name="plus" size={18} strokeWidth={3} />}
          {busy ? "Đang lưu..." : submitLabel}
        </button>
        {onCancel && <button className="btn" type="button" onClick={onCancel} disabled={busy}>Huỷ</button>}
      </div>
    </form>
  );
}

/** Chọn việc lặp vào những thứ nào trong tuần */
export function RepeatPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const presets: [string, number][] = [["Mỗi ngày", REPEAT_ALL], ["T2–T6", REPEAT_WEEKDAYS], ["Cuối tuần", REPEAT_WEEKEND], ["Chỉ ngày tôi chọn", 0]];
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div role="group" aria-label="Lặp lại nhanh" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {presets.map(([label, mask]) => (
          <button key={label} type="button" className="pill" aria-pressed={value === mask} onClick={() => onChange(mask)}
            style={{ minHeight: 36, borderColor: value === mask ? "var(--ink)" : "transparent", background: value === mask ? "var(--coin-soft)" : "var(--sand)" }}>
            {label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Chọn từng thứ" style={{ display: "flex", gap: 6 }}>
        {DOW_SHORT.map((d, i) => {
          const on = ((value >> i) & 1) === 1;
          return (
            <button key={d} type="button" aria-pressed={on} aria-label={`Lặp vào ${d}`} onClick={() => onChange(value ^ (1 << i))}
              style={{ flex: 1, minHeight: 44, borderRadius: 12, fontWeight: 800, fontSize: 13, border: `2.5px solid ${on ? "var(--ink)" : "var(--sand)"}`, background: on ? "var(--mint)" : "#fff" }}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const num = (s: string) => Number(s.replace(/\D/g, "")) || 0;

/* ---------- Việc tốt / checklist ---------- */
/** Suy ra loại việc từ những người được giao: chỉ các con, con cùng bố mẹ, hay checklist của bố mẹ */
export function deriveAssign(members: Member[], selected: string[]): { who: Who; kids?: string[]; parents?: string[] } | null {
  const kids = members.filter((m) => m.role === "kid");
  const parents = members.filter((m) => m.role === "parent");
  const k = kids.filter((m) => selected.includes(m.id)).map((m) => m.id);
  const p = parents.filter((m) => selected.includes(m.id)).map((m) => m.id);
  if (!k.length && !p.length) return null;
  return {
    who: k.length && p.length ? "together" : k.length ? "kid" : "parent",
    kids: k.length && k.length < kids.length ? k : undefined, // không ghi = tất cả các bé
    parents: p.length && p.length < parents.length ? p : undefined,
  };
}

/** Người đang được giao của một việc đã có (để mở lại form sửa) */
export function assignedIds(members: Member[], t: Task): string[] {
  const kids = members.filter((m) => m.role === "kid").map((m) => m.id);
  const parents = members.filter((m) => m.role === "parent").map((m) => m.id);
  const k = t.who === "parent" ? [] : t.kids ?? kids;
  const p = t.who === "kid" ? [] : t.parents ?? parents;
  return [...k, ...p];
}

/** "Giao cho": bấm vào từng người để gắn thẻ, hoặc chọn nhanh Cả nhà / Các con / Bố mẹ */
export function AssignPicker({ members, value, onChange }: { members: Member[]; value: string[]; onChange: (v: string[]) => void }) {
  const kids = members.filter((m) => m.role === "kid");
  const parents = members.filter((m) => m.role === "parent");
  const sel = new Set(value);
  const same = (ids: string[]) => ids.length === value.length && ids.every((id) => sel.has(id));
  const presets: [string, string[]][] = [
    ["Cả nhà", members.map((m) => m.id)],
    ["Tất cả các con", kids.map((m) => m.id)],
    ["Bố mẹ", parents.map((m) => m.id)],
  ];
  const toggle = (id: string) => onChange(sel.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  const d = deriveAssign(members, value);
  const hint = !d
    ? "Chưa chọn ai"
    : d.who === "kid" ? "Các bé được gắn thẻ tự làm, bố mẹ gật đầu."
    : d.who === "together" ? "Làm cùng nhau: con làm xong, bố mẹ được gắn thẻ cùng nhận Ủn."
    : "Mục checklist của bố mẹ: các con chấm Đạt.";
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div role="group" aria-label="Chọn nhanh" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {presets.map(([label, ids]) => (
          <button key={label} type="button" className="pill" aria-pressed={same(ids)} onClick={() => onChange(ids)}
            style={{ minHeight: 36, borderColor: same(ids) ? "var(--ink)" : "transparent", background: same(ids) ? "var(--coin-soft)" : "var(--sand)" }}>
            {label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Từng người" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {members.map((m) => (
          <button key={m.id} type="button" aria-pressed={sel.has(m.id)} onClick={() => toggle(m.id)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "4px 12px 4px 6px", borderRadius: 999, fontWeight: 800, fontSize: 14,
              border: `2.5px solid ${sel.has(m.id) ? "var(--ink)" : "var(--sand)"}`, background: sel.has(m.id) ? "var(--mint-soft)" : "#fff" }}>
            <Avatar m={m} size={28} fs={12} />{m.name}
            {sel.has(m.id) && <Icon name="check" size={14} strokeWidth={3.6} />}
          </button>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{hint}</div>
    </div>
  );
}

export function TaskForm({ initial, members, onSave, onCancel, forDayLabel }: {
  initial?: Task; members: Member[]; onSave: (v: TaskInput) => Promise<boolean>; onCancel?: () => void;
  /** Có giá trị: thêm một việc chỉ cho đúng ngày này (không chọn lịch lặp) */
  forDayLabel?: string;
}) {
  const kidIds = members.filter((m) => m.role === "kid").map((m) => m.id);
  const defaults = { title: "", coins: "10", slot: "sang" as Slot, icon: "star" as IconName, repeat: REPEAT_ALL };
  const [v, setV] = useState(initial ? { title: initial.title, coins: String(initial.coins), slot: initial.slot, icon: initial.icon, repeat: initial.repeat } : defaults);
  const [sel, setSel] = useState<string[]>(initial ? assignedIds(members, initial) : kidIds);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const coins = num(v.coins);
    const a = deriveAssign(members, sel);
    if (!v.title.trim()) return setErr("Nhập tên việc tốt nhé");
    if (coins < 1 || coins > 200) return setErr("Số Ủn phải từ 1 đến 200");
    if (!a) return setErr("Chọn ít nhất 1 người được giao");
    setErr(""); setBusy(true);
    const ok = await onSave({ title: v.title, coins, slot: v.slot, icon: v.icon, repeat: forDayLabel ? 0 : v.repeat, ...a });
    setBusy(false);
    if (!ok) return;
    if (editing) onCancel?.();
    else setV({ ...defaults, slot: v.slot, icon: v.icon });
  }

  return (
    <FormShell title={editing ? undefined : forDayLabel ? `Thêm việc cho ${forDayLabel}` : "Thêm vào kho việc tốt"} onSubmit={submit} error={err} busy={busy} submitLabel={editing ? "Lưu" : forDayLabel ? "Thêm vào ngày này" : "Thêm việc tốt"} onCancel={onCancel}>
      <label className="lbl">Tên việc tốt
        <input className="field" name="title" value={v.title} maxLength={40} placeholder="Ví dụ: Tự đánh răng" onChange={(e) => set("title", e.target.value)} />
      </label>
      <div className="grid2">
        <label className="lbl">Số Ủn (1–200)
          <input className="field" name="coins" inputMode="numeric" value={v.coins} onChange={(e) => set("coins", e.target.value)} />
        </label>
        <label className="lbl">Buổi
          <select className="field" name="slot" value={v.slot} onChange={(e) => set("slot", e.target.value as Slot)}>
            {(Object.keys(SLOTS) as Slot[]).map((s) => <option key={s} value={s}>{SLOT_SHORT[s]}</option>)}
          </select>
        </label>
      </div>
      <div className="lbl">Giao cho<AssignPicker members={members} value={sel} onChange={setSel} /></div>
      {!forDayLabel && <div className="lbl">Lặp lại vào<RepeatPicker value={v.repeat} onChange={(r) => set("repeat", r)} /></div>}
      <div className="lbl">Biểu tượng<IconPicker icons={TASK_ICONS} value={v.icon} onChange={(i) => set("icon", i)} /></div>
    </FormShell>
  );
}

/* ---------- Phiếu đi chơi ---------- */
export function RewardForm({ initial, onSave, onCancel }: { initial?: Reward; onSave: (v: RewardInput) => Promise<boolean>; onCancel?: () => void }) {
  const defaults = { title: "", cost: "100", tier: "nho" as Tier, icon: "gift" as IconName };
  const [v, setV] = useState(initial ? { title: initial.title, cost: String(initial.cost), tier: initial.tier, icon: initial.icon } : defaults);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cost = num(v.cost);
    if (!v.title.trim()) return setErr("Nhập tên phiếu nhé");
    if (cost < 1) return setErr("Giá phiếu phải lớn hơn 0");
    setErr(""); setBusy(true);
    const ok = await onSave({ title: v.title, cost, tier: v.tier, icon: v.icon });
    setBusy(false);
    if (!ok) return;
    if (editing) onCancel?.();
    else setV({ ...defaults, tier: v.tier, icon: v.icon });
  }

  return (
    <FormShell title={editing ? undefined : "Thêm phiếu đi chơi"} onSubmit={submit} error={err} busy={busy} submitLabel={editing ? "Lưu" : "Thêm phiếu đi chơi"} onCancel={onCancel}>
      <label className="lbl">Tên phiếu
        <input className="field" name="title" value={v.title} maxLength={40} placeholder="Ví dụ: Đi bơi cùng bố" onChange={(e) => set("title", e.target.value)} />
      </label>
      <div className="grid2">
        <label className="lbl">Giá (Ủn)
          <input className="field" name="cost" inputMode="numeric" value={v.cost} onChange={(e) => set("cost", e.target.value)} />
        </label>
        <label className="lbl">Tầng
          <select className="field" name="tier" value={v.tier} onChange={(e) => set("tier", e.target.value as Tier)}>
            {(Object.keys(TIERS) as Tier[]).map((t) => <option key={t} value={t}>{TIER_SHORT[t]}</option>)}
          </select>
        </label>
      </div>
      <div className="lbl">Biểu tượng<IconPicker icons={REWARD_ICONS} value={v.icon} onChange={(i) => set("icon", i)} /></div>
    </FormShell>
  );
}

/* ---------- Kèo cả nhà ---------- */
export function ChallengeForm({ initial, members, tasks, onSave, onCancel }: {
  initial?: Challenge; members: Member[]; tasks: Task[];
  onSave: (v: ChallengeInput & { a: string; b: string }) => Promise<boolean>; onCancel?: () => void;
}) {
  const firstParent = members.find((m) => m.role === "parent")?.id ?? "";
  const firstKid = members.find((m) => m.role === "kid")?.id ?? "";
  const defaults = { title: "", a: firstParent, b: firstKid, target: "5", prize: "", linkedTask: "" };
  const [v, setV] = useState(initial
    ? { title: initial.title, a: initial.a, b: initial.b, target: String(initial.target), prize: initial.prize, linkedTask: initial.linkedTask ?? "" }
    : defaults);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const target = num(v.target);
    if (!v.title.trim()) return setErr("Đặt tên thử thách nhé");
    if (v.a === v.b) return setErr("Chọn 2 người khác nhau");
    if (target < 1 || target > 14) return setErr("Số ngày cần đạt từ 1 đến 14");
    setErr(""); setBusy(true);
    const ok = await onSave({ title: v.title, a: v.a, b: v.b, target, prize: v.prize, linkedTask: v.linkedTask || undefined });
    setBusy(false);
    if (!ok) return;
    if (editing) onCancel?.();
    else setV({ ...defaults, a: v.a, b: v.b });
  }

  return (
    <FormShell title={editing ? undefined : "Lên kèo mới"} onSubmit={submit} error={err} busy={busy} submitLabel={editing ? "Lưu" : "Lên kèo"} onCancel={onCancel}>
      <label className="lbl">Thử thách
        <input className="field" name="title" value={v.title} maxLength={60} placeholder="Ví dụ: Ai dậy trước 6h30 đủ 5 ngày?" onChange={(e) => set("title", e.target.value)} />
      </label>
      {!editing && (
        <div className="grid2">
          <label className="lbl">Người 1
            <select className="field" name="a" value={v.a} onChange={(e) => set("a", e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </label>
          <label className="lbl">Người 2
            <select className="field" name="b" value={v.b} onChange={(e) => set("b", e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </label>
        </div>
      )}
      <div className="grid2">
        <label className="lbl">Số ngày cần đạt
          <input className="field" name="target" inputMode="numeric" value={v.target} onChange={(e) => set("target", e.target.value)} />
        </label>
        <label className="lbl">Phần thưởng
          <input className="field" name="prize" value={v.prize} maxLength={60} placeholder="Chọn phim tối thứ Bảy" onChange={(e) => set("prize", e.target.value)} />
        </label>
      </div>
      <label className="lbl">Tự +1 khi việc tốt này được gật đầu (không bắt buộc)
        <select className="field" name="linkedTask" value={v.linkedTask} onChange={(e) => set("linkedTask", e.target.value)}>
          <option value="">Không, bố mẹ tự +1</option>
          {tasks.filter((t) => t.who !== "parent").map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </label>
    </FormShell>
  );
}

/* ---------- Thành viên ---------- */
export function MemberEditForm({ member, onSave, onCancel }: { member: Member; onSave: (v: { name: string; color: string; avatar?: string }) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = useState(member.name);
  const [color, setColor] = useState(member.color);
  const [avatar, setAvatar] = useState<string | undefined>(member.avatar);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const palette = member.role === "parent" ? PARENT_COLORS : KID_COLORS;
  const colors = palette.includes(member.color) ? palette : [member.color, ...palette];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Nhập tên nhé");
    setErr(""); setBusy(true);
    const ok = await onSave({ name, color, avatar });
    setBusy(false);
    if (ok) onCancel();
  }
  return (
    <FormShell onSubmit={submit} error={err} busy={busy} submitLabel="Lưu" onCancel={onCancel}>
      <label className="lbl">Tên
        <input className="field" name="name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="lbl">Hình đại diện
        <div role="radiogroup" aria-label="Hình đại diện" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" role="radio" aria-checked={!avatar} aria-label="Dùng chữ cái đầu" onClick={() => setAvatar(undefined)}
            style={{ width: 44, height: 44, borderRadius: "50%", background: color, fontWeight: 800, fontSize: 16, border: `3px solid ${!avatar ? "var(--ink)" : "transparent"}` }}>
            {member.initial}
          </button>
          {AVATARS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={avatar === a} aria-label={`Hình ${a}`} onClick={() => setAvatar(a)}
              style={{ width: 44, height: 44, borderRadius: "50%", background: color, fontSize: 24, lineHeight: 1, border: `3px solid ${avatar === a ? "var(--ink)" : "transparent"}` }}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="lbl">Màu nền
        <div role="radiogroup" aria-label="Màu đại diện" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {colors.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={`Màu ${c}`} onClick={() => setColor(c)}
              style={{ width: 44, height: 44, borderRadius: "50%", background: c, border: `3px solid ${c === color ? "var(--ink)" : "transparent"}`, boxShadow: c === color ? "0 0 0 2px #fff inset" : "none" }} />
          ))}
        </div>
      </div>
    </FormShell>
  );
}
