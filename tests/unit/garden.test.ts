import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { today } from "@/lib/data";
import {
  POTS, SLOT_PRICE, SPECIES, capLeft, earnedOf, finalStage, freeSlot, isRipe, isSad, keepOf, needOf, plantStage, refreshEarned, ruleBuyPot, ruleBuySeed, ruleBuySlot,
  ruleHarvest, ruleSetPot, ruleStartGarden, ruleWater, speciesOf, stageOf, waterBank,
} from "@/lib/garden";
import { familyFixture } from "./fixture";

const approve = (S: ReturnType<typeof familyFixture>, task: string, member = "bin", date = today()) =>
  S.subs.push({ id: `${member}-${task}-${date}`, member, task, date, status: "approved", time: "08:00" });

const started = () => {
  const S = familyFixture();
  S.coins.bin = 500;
  ruleStartGarden(S, "bin");
  return S;
};

describe("danh mục khớp với database", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/018_garden_v2.sql"), "utf8");
  const potsSql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/019_garden_cat_pots.sql"), "utf8");
  it("loài cây (giá, nước cần, quả, mốc quay về sau khi hái) giống hàm garden_species", () => {
    const rows = [...sql.matchAll(/\('([a-z_]+)', (\d+), (\d+), (\d+), (\d+)\)/g)].map((m) => ({ id: m[1], price: +m[2], need: +m[3], fruit: +m[4], keep: +m[5] }));
    expect(rows.length).toBe(SPECIES.length);
    for (const r of rows) {
      const s = SPECIES.find((x) => x.id === r.id);
      expect(s, r.id).toBeTruthy();
      expect({ price: s!.price, need: needOf(s!), fruit: s!.fruit, keep: keepOf(s!) }).toEqual({ price: r.price, need: r.need, fruit: r.fruit, keep: r.keep });
    }
  });
  it("chậu và giá mở ô giống hàm garden_pots, garden_slot_price", () => {
    const pots = [...potsSql.matchAll(/\('([a-z_]+)', (\d+)\)/g)].map((m) => ({ id: m[1], price: +m[2] })).filter((p) => POTS.some((x) => x.id === p.id));
    expect(pots.length).toBe(POTS.length);
    for (const p of pots) expect(POTS.find((x) => x.id === p.id)!.price).toBe(p.price);
    expect(sql).toContain("when 3 then 60 when 4 then 120");
    expect(SLOT_PRICE).toEqual({ 3: 60, 4: 120 });
  });
  it("mốc giai đoạn tăng dần, loài hoa có 4 mốc, loài quả có 5 mốc", () => {
    for (const s of SPECIES) {
      expect(s.stages.length).toBe(s.kind === "flower" ? 4 : 5);
      expect([...s.stages].sort((a, b) => a - b)).toEqual(s.stages);
      expect(new Set(s.stages).size).toBe(s.stages.length);
      expect(keepOf(s)).toBeLessThan(needOf(s));
    }
  });
  it("nhịp lớn khác nhau: Hy vọng 10 giọt, hướng dương 20 giọt mới ra hoa", () => {
    expect(needOf(speciesOf("hy_vong"))).toBe(10);
    expect(needOf(speciesOf("cham_chi"))).toBe(20);
    expect(finalStage(speciesOf("cham_chi"))).toBe(4);
    expect(finalStage(speciesOf("ky_luat"))).toBe(5);
  });
});

describe("giai đoạn của cây", () => {
  it("loài hoa (Hy vọng, mốc 1-3-6-10) dừng ở ra hoa", () => {
    const sp = speciesOf("hy_vong");
    expect([0, 1, 2, 3, 5, 6, 9, 10, 99].map((w) => stageOf(w, sp))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it("loài quả (Dũng cảm, mốc 3-7-12-18-25) ra quả ở mốc cuối", () => {
    const sp = speciesOf("dung_cam");
    expect([2, 3, 12, 17, 18, 24, 25].map((w) => stageOf(w, sp))).toEqual([0, 1, 3, 3, 4, 4, 5]);
  });
});

describe("bắt đầu chơi", () => {
  it("có sẵn Cây Hy vọng miễn phí ở ô 1 và 2 ô đất", () => {
    const S = started();
    const g = S.gardens.bin;
    expect(g.slots).toBe(2);
    expect(g.plants.map((p) => p.species)).toEqual(["hy_vong"]);
    expect(S.coins.bin).toBe(500);
    expect(freeSlot(g)).toBe(2);
  });
  it("gọi lại không trồng thêm", () => {
    const S = started();
    ruleStartGarden(S, "bin");
    expect(S.gardens.bin.plants).toHaveLength(1);
  });
  it("bố mẹ tắt vườn thì không chơi được", () => {
    const S = familyFixture();
    S.settings.gardenEnabled = false;
    expect(() => ruleStartGarden(S, "bin")).toThrow("garden_off");
  });
});

describe("nước và tưới cây", () => {
  it("mỗi việc gật đầu 1 giọt, việc làm cùng bố mẹ 2 giọt, chỉ tính từ ngày bắt đầu", () => {
    const S = started();
    approve(S, "t1"); approve(S, "g1");
    approve(S, "t1", "bin", "2020-01-01"); // trước ngày bắt đầu
    refreshEarned(S);
    expect(S.gardens.bin.earned).toBe(3);
    expect(earnedOf(S, "bin", today())).toBe(3);
    expect(waterBank(S.gardens.bin)).toBe(3);
  });
  it("tưới trừ vào bình, không tưới quá số có, không tưới quá số cây cần", () => {
    const S = started();
    S.gardens.bin.earned = 50;
    const id = S.gardens.bin.plants[0].id;
    expect(ruleWater(S, id, 5)).toBe(5);
    expect(waterBank(S.gardens.bin)).toBe(45);
    expect(ruleWater(S, id, 100)).toBe(5); // Cây Hy vọng cần 10, đã có 5
    expect(S.gardens.bin.plants[0].watered).toBe(10);
    expect(isRipe(S.gardens.bin.plants[0])).toBe(true);
    expect(() => ruleWater(S, id, 1)).toThrow("ready_to_harvest");
  });
  it("hết nước thì báo, số giọt phải từ 1", () => {
    const S = started();
    const id = S.gardens.bin.plants[0].id;
    expect(() => ruleWater(S, id, 1)).toThrow("no_water");
    S.gardens.bin.earned = 3;
    expect(() => ruleWater(S, id, 0)).toThrow("invalid_amount");
  });
  it("cây lâu không tưới thì buồn, tưới lại là tươi", () => {
    const S = started();
    const p = S.gardens.bin.plants[0];
    expect(isSad(p)).toBe(false);
    p.plantedAt = new Date(Date.now() - 4 * 86_400_000).toISOString();
    expect(isSad(p)).toBe(true);
    S.gardens.bin.earned = 2;
    ruleWater(S, p.id, 1);
    expect(isSad(p)).toBe(false);
  });
});

describe("mua sắm", () => {
  it("mua hạt giống trừ Ủn và trồng vào ô trống", () => {
    const S = started();
    ruleBuySeed(S, "bin", "cham_chi", 2);
    expect(S.coins.bin).toBe(470);
    expect(S.gardens.bin.spentWeek).toBe(30);
    expect(S.gardens.bin.plants.map((p) => p.slot)).toEqual([1, 2]);
    expect(freeSlot(S.gardens.bin)).toBeNull();
  });
  it("các lỗi: ô có cây, ô chưa mở, cây miễn phí, loài lạ, thiếu Ủn", () => {
    const S = started();
    expect(() => ruleBuySeed(S, "bin", "ngoan", 1)).toThrow("slot_taken");
    expect(() => ruleBuySeed(S, "bin", "ngoan", 3)).toThrow("invalid_slot");
    expect(() => ruleBuySeed(S, "bin", "hy_vong", 2)).toThrow("invalid_species");
    expect(() => ruleBuySeed(S, "bin", "xyz", 2)).toThrow("invalid_species");
    S.coins.bin = 10;
    expect(() => ruleBuySeed(S, "bin", "cham_chi", 2)).toThrow("insufficient");
    expect(S.coins.bin).toBe(10);
  });
  it("trần chi tiêu mỗi tuần", () => {
    const S = started();
    S.settings.gardenCap = 40;
    ruleBuySeed(S, "bin", "cham_chi", 2);
    expect(capLeft(S, S.gardens.bin)).toBe(10);
    expect(() => ruleBuyPot(S, "bin", "xanh")).toThrow("weekly_cap");
  });
  it("mở ô: ô 3 giá 60, ô 4 giá 120, không quá 4 ô", () => {
    const S = started();
    S.coins.bin = 1000; S.settings.gardenCap = 5000;
    expect(ruleBuySlot(S, "bin")).toBe(3);
    expect(S.coins.bin).toBe(940);
    expect(ruleBuySlot(S, "bin")).toBe(4);
    expect(S.coins.bin).toBe(820);
    expect(() => ruleBuySlot(S, "bin")).toThrow("max_slots");
  });
  it("chậu: mua một lần, phải có mới dùng được", () => {
    const S = started();
    const id = S.gardens.bin.plants[0].id;
    expect(() => ruleSetPot(S, id, "sao")).toThrow("not_owned");
    ruleBuyPot(S, "bin", "xanh");
    expect(() => ruleBuyPot(S, "bin", "xanh")).toThrow("already_owned");
    expect(() => ruleBuyPot(S, "bin", "dat")).toThrow("invalid_item");
    ruleSetPot(S, id, "xanh");
    expect(S.gardens.bin.plants[0].pot).toBe("xanh");
    ruleSetPot(S, id, "dat");
    expect(S.gardens.bin.plants[0].pot).toBe("dat");
  });
});

describe("thu hoạch", () => {
  it("cây ra hoa thì hái được và nhận Ủn, quay về mốc cây lớn để ra hoa lần nữa", () => {
    const S = started();
    const p = S.gardens.bin.plants[0];
    expect(() => ruleHarvest(S, p.id)).toThrow("not_ready");
    p.watered = 10;
    expect(plantStage(p)).toBe(4);
    expect(ruleHarvest(S, p.id)).toBe(6);
    expect(S.coins.bin).toBe(506);
    expect(p.watered).toBe(6);
    expect(p.harvests).toBe(1);
    expect(plantStage(p)).toBe(3);
  });
  it("loài quả: chỉ hái khi ra quả; cây sồi cho quả vàng 90 Ủn", () => {
    const S = started();
    S.coins.bin = 1000; S.settings.gardenCap = 5000;
    ruleBuySlot(S, "bin");
    const id = ruleBuySeed(S, "bin", "kien_nhan", 2);
    const p = S.gardens.bin.plants.find((x) => x.id === id)!;
    p.watered = 42; // đã ra hoa nhưng chưa ra quả
    expect(plantStage(p)).toBe(4);
    expect(() => ruleHarvest(S, id)).toThrow("not_ready");
    p.watered = 60;
    expect(ruleHarvest(S, id)).toBe(90);
    expect(p.watered).toBe(28);
  });
});
