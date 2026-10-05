import { today } from "./data";
import type { Data, Garden, Plant, PotId, SpeciesId } from "./types";

/**
 * Khu vườn Ủn: danh mục, giai đoạn và luật chơi. Bản sao của hàm database garden_species / garden_pots
 * (có bài test đối chiếu với supabase/migrations/014_garden.sql). Luật dưới đây dùng cho bản dùng thử
 * và để giao diện phản hồi ngay; server mới là nơi quyết định.
 */
export type Speed = "nhanh" | "vua" | "cham";
export type Species = {
  id: SpeciesId; name: string; trait: string; blurb: string;
  price: number; need: number; fruit: number; golden: boolean; speed: Speed;
  leaf: string; accent: string; fruitColor: string;
};

export const SPECIES: Species[] = [
  { id: "hy_vong", name: "Cây Hy vọng", trait: "Hy vọng", blurb: "Mầm vàng nhỏ luôn hướng về mặt trời. Cây đầu tiên của mỗi bạn.", price: 0, need: 40, fruit: 20, golden: false, speed: "nhanh", leaf: "#6FCF73", accent: "#FFC93C", fruitColor: "#FFC93C" },
  { id: "cham_chi", name: "Cây Chăm chỉ", trait: "Chăm chỉ", blurb: "Hoa hướng dương làm việc mỗi ngày, không bỏ sót buổi nào.", price: 50, need: 70, fruit: 40, golden: false, speed: "vua", leaf: "#4FBF67", accent: "#FFB800", fruitColor: "#8B5A2B" },
  { id: "ngoan", name: "Cây Ngoan ngoãn", trait: "Ngoan ngoãn", blurb: "Hoa cúc trắng hiền lành, biết nghe lời và giúp đỡ mọi người.", price: 50, need: 40, fruit: 30, golden: false, speed: "nhanh", leaf: "#6FCF73", accent: "#FFFFFF", fruitColor: "#FF8FB8" },
  { id: "ky_luat", name: "Cây Kỷ luật", trait: "Kỷ luật", blurb: "Cây tre thẳng tắp, dậy đúng giờ, ngủ đúng giờ.", price: 80, need: 70, fruit: 50, golden: false, speed: "vua", leaf: "#3FA773", accent: "#86D08B", fruitColor: "#FF6FA3" },
  { id: "dung_cam", name: "Cây Dũng cảm", trait: "Dũng cảm", blurb: "Xương rồng nhỏ không sợ nắng gió, dám thử việc khó.", price: 80, need: 70, fruit: 50, golden: false, speed: "vua", leaf: "#4CAF7A", accent: "#FF6FA3", fruitColor: "#E5484D" },
  { id: "kien_nhan", name: "Cây Kiên nhẫn", trait: "Kiên nhẫn", blurb: "Cây sồi lớn chậm nhưng ra quả vàng quý giá.", price: 120, need: 120, fruit: 120, golden: true, speed: "cham", leaf: "#3E9B5A", accent: "#8FD16F", fruitColor: "#FFC93C" },
];
export const speciesOf = (id: string): Species => SPECIES.find((s) => s.id === id) ?? SPECIES[0];
export const SPEED_LABEL: Record<Speed, string> = { nhanh: "Lớn nhanh", vua: "Lớn vừa", cham: "Lớn chậm" };

export type Pot = { id: PotId; name: string; price: number; body: string; rim: string };
export const POTS: Pot[] = [
  { id: "dat", name: "Chậu đất", price: 0, body: "#C98B5B", rim: "#A9693B" },
  { id: "xanh", name: "Chậu xanh", price: 30, body: "#5BC0EB", rim: "#3A9BCB" },
  { id: "hong", name: "Chậu hồng", price: 30, body: "#FF8FB8", rim: "#E06C98" },
  { id: "sao", name: "Chậu ngôi sao", price: 60, body: "#FFC93C", rim: "#E0A800" },
  { id: "cau_vong", name: "Chậu cầu vồng", price: 100, body: "#B9A6FF", rim: "#8B6CFF" },
];
export const potOf = (id: string): Pot => POTS.find((p) => p.id === id) ?? POTS[0];

export const SLOT_PRICE: Record<number, number> = { 3: 100, 4: 200 };
export const MAX_SLOTS = 4;
export const START_SLOTS = 2;
export const DEFAULT_WEEKLY_CAP = 300;
export const SAD_AFTER_DAYS = 3;

/* ---------- Giai đoạn ---------- */
export const STAGE_NAMES = ["Hạt giống", "Mầm", "Cây con", "Cây lớn", "Ra hoa", "Ra quả"];
/** 0 hạt, 1 mầm, 2 cây con, 3 cây lớn, 4 ra hoa, 5 ra quả: nhảy ở 10%, 25%, 50%, 80%, 100% */
export function stageOf(watered: number, need: number): number {
  const p = need > 0 ? watered / need : 0;
  return p >= 1 ? 5 : p >= 0.8 ? 4 : p >= 0.5 ? 3 : p >= 0.25 ? 2 : p >= 0.1 ? 1 : 0;
}
export const plantStage = (p: Plant) => stageOf(p.watered, speciesOf(p.species).need);
export const progressOf = (p: Plant) => Math.min(100, Math.round((p.watered / speciesOf(p.species).need) * 100));

/** Số giọt nước còn trong bình */
export const waterBank = (g: Garden) => Math.max(0, g.earned - g.plants.reduce((a, p) => a + p.poured, 0));
/** Cây buồn: lâu không được tưới (không mất gì, tưới lại là tươi) */
export function isSad(p: Plant, now = Date.now()): boolean {
  if (plantStage(p) >= 5) return false;
  const since = new Date(p.lastWateredAt ?? p.plantedAt).getTime();
  return now - since > SAD_AFTER_DAYS * 86_400_000;
}
/** Số Ủn còn được chi cho vườn trong tuần này */
export const capLeft = (S: Data, g: Garden) => Math.max(0, S.settings.gardenCap - g.spentWeek);
export const freeSlot = (g: Garden): number | null => {
  for (let i = 1; i <= g.slots; i++) if (!g.plants.some((p) => p.slot === i)) return i;
  return null;
};

/* ---------- Luật chơi (bản dùng thử + cập nhật tức thì) ---------- */
const fail = (code: string): never => { throw new Error(code); };
const gardenOf = (S: Data, member: string): Garden => S.gardens[member] ?? fail("no_garden");
const findPlant = (S: Data, id: string): { g: Garden; p: Plant } => {
  for (const g of Object.values(S.gardens)) { const p = g.plants.find((x) => x.id === id); if (p) return { g, p }; }
  return fail("invalid_plant");
};

/** Giọt nước kiếm được trong bản dùng thử: việc gật đầu từ ngày bắt đầu (việc làm cùng nhân đôi) */
export function earnedOf(S: Data, member: string, startedDay: string): number {
  let n = 0;
  for (const s of S.subs) {
    if (s.member !== member || s.status !== "approved" || s.date < startedDay) continue;
    n += S.tasks.find((t) => t.id === s.task)?.who === "together" ? 2 : 1;
  }
  return n;
}
export function refreshEarned(S: Data) {
  for (const g of Object.values(S.gardens)) g.earned = earnedOf(S, g.member, g.startedAt.slice(0, 10));
}

let seq = 0;
const newId = () => `tmp-${Date.now().toString(36)}${++seq}`;

function guard(S: Data) {
  if (!S.settings.gardenEnabled) fail("garden_off");
}

export function ruleStartGarden(S: Data, member: string) {
  guard(S);
  if (S.gardens[member]) return;
  const g: Garden = { member, startedAt: new Date(today() + "T00:00:00Z").toISOString(), slots: START_SLOTS, earned: 0, spentWeek: 0, plants: [], items: [] };
  g.plants.push({ id: newId(), species: "hy_vong", slot: 1, watered: 0, poured: 0, harvests: 0, pot: "dat", lastWateredAt: null, plantedAt: new Date().toISOString() });
  S.gardens[member] = g;
  refreshEarned(S);
}

function spend(S: Data, g: Garden, price: number) {
  if ((S.coins[g.member] ?? 0) < price) fail("insufficient");
  if (g.spentWeek + price > S.settings.gardenCap) fail("weekly_cap");
  S.coins[g.member] -= price;
  g.spentWeek += price;
}

export function ruleBuySeed(S: Data, member: string, species: string, slot: number): string {
  guard(S);
  const g = gardenOf(S, member);
  const sp = SPECIES.find((s) => s.id === species);
  if (!sp || sp.price <= 0) fail("invalid_species");
  if (slot < 1 || slot > g.slots) fail("invalid_slot");
  if (g.plants.some((p) => p.slot === slot)) fail("slot_taken");
  spend(S, g, sp!.price);
  const id = newId();
  g.plants.push({ id, species: species as SpeciesId, slot, watered: 0, poured: 0, harvests: 0, pot: "dat", lastWateredAt: null, plantedAt: new Date().toISOString() });
  g.plants.sort((a, b) => a.slot - b.slot);
  return id;
}

export function ruleBuySlot(S: Data, member: string): number {
  guard(S);
  const g = gardenOf(S, member);
  const price = SLOT_PRICE[g.slots + 1];
  if (price === undefined) fail("max_slots");
  spend(S, g, price);
  g.slots += 1;
  return g.slots;
}

export function ruleBuyPot(S: Data, member: string, item: string) {
  guard(S);
  const g = gardenOf(S, member);
  const pot = POTS.find((p) => p.id === item);
  if (!pot || pot.price <= 0) fail("invalid_item");
  if (g.items.includes(item)) fail("already_owned");
  spend(S, g, pot!.price);
  g.items.push(item);
}

export function ruleSetPot(S: Data, plantId: string, item: string) {
  guard(S);
  const { g, p } = findPlant(S, plantId);
  if (!POTS.some((x) => x.id === item)) fail("invalid_item");
  if (item !== "dat" && !g.items.includes(item)) fail("not_owned");
  p.pot = item as PotId;
}

export function ruleWater(S: Data, plantId: string, amount: number): number {
  guard(S);
  const { g, p } = findPlant(S, plantId);
  const sp = speciesOf(p.species);
  if (!(amount >= 1)) fail("invalid_amount");
  if (p.watered >= sp.need) fail("ready_to_harvest");
  const bank = waterBank(g);
  if (bank < 1) fail("no_water");
  const amt = Math.min(amount, bank, sp.need - p.watered);
  p.watered += amt; p.poured += amt; p.lastWateredAt = new Date().toISOString();
  return amt;
}

export function ruleHarvest(S: Data, plantId: string): number {
  guard(S);
  const { g, p } = findPlant(S, plantId);
  const sp = speciesOf(p.species);
  if (p.watered < sp.need) fail("not_ready");
  p.watered = Math.floor((sp.need + 1) / 2);
  p.harvests += 1;
  S.coins[g.member] = (S.coins[g.member] ?? 0) + sp.fruit;
  return sp.fruit;
}

