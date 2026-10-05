"use client";

import { useState, type ReactNode } from "react";
import { Coin } from "@/components/Coin";
import { Icon } from "@/components/Icon";
import { Pig } from "@/components/Pig";
import { Pot, PlantArt } from "@/components/Plant";
import {
  MAX_SLOTS, POTS, SLOT_PRICE, SPECIES, SPEED_LABEL, STAGE_NAMES, capLeft, finalStage, freeSlot, harvestVerb, isRipe, isSad, needOf, plantStage, progressOf, speciesOf, waterBank,
} from "@/lib/garden";
import { useApp } from "@/lib/store";
import type { Garden, Plant } from "@/lib/types";
import { Avatar, Empty } from "./common";

const TABS: { v: "garden" | "shop" | "race"; label: string }[] = [
  { v: "garden", label: "Vườn của con" }, { v: "shop", label: "Cửa hàng" }, { v: "race", label: "Đua vườn" },
];

/* ---------- Một ô cây ---------- */
function PlotCard({ g, p }: { g: Garden; p: Plant }) {
  const { A } = useApp();
  const sp = speciesOf(p.species);
  const stage = plantStage(p);
  const sad = isSad(p);
  const bank = waterBank(g);
  const need = needOf(sp);
  const left = need - p.watered;
  const ready = isRipe(p);
  const [potOpen, setPotOpen] = useState(false);
  const owned = POTS.filter((x) => x.id === "dat" || g.items.includes(x.id));
  const five = Math.min(5, bank, left);

  return (
    <section className={`card stack plot ${ready ? "ready" : ""}`} aria-label={`${sp.name} ở ô ${p.slot}`} style={{ gap: 6, alignItems: "stretch" }}>
      <div className={ready ? "bob" : undefined} style={{ display: "flex", justifyContent: "center" }}>
        <PlantArt species={p.species} stage={stage} pot={p.pot} sad={sad} size={118} />
      </div>
      <div style={{ textAlign: "center" }}>
        <b style={{ fontSize: 15 }}>{sp.name}</b>
        <div className="muted" style={{ fontSize: 12 }}>{STAGE_NAMES[stage]}{ready ? " · hái được rồi!" : ` · ${p.watered}/${need} giọt`}{p.harvests > 0 ? ` · đã thu hoạch ${p.harvests} lần` : ""}</div>
      </div>
      <div className="bar" role="img" aria-label={`Tiến độ ${progressOf(p)}%`}><i style={{ width: `${progressOf(p)}%` }} /></div>
      {sad && <div className="pill" style={{ background: "#E8F4FB", alignSelf: "center" }}>Cây đang buồn, tưới cho cây nhé</div>}
      {ready ? (
        <button className="btn mint" onClick={() => A.harvest(p.id)}>
          <Icon name="star" size={18} strokeWidth={3} />{harvestVerb(sp)} +{sp.fruit} Ủn
        </button>
      ) : (
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm grow" disabled={bank < 1} onClick={() => A.water(p.id, 1)}>
            <span aria-hidden="true">💧</span>Tưới 1
          </button>
          {five > 1 && (
            <button className="btn sm grow" onClick={() => A.water(p.id, five)}><span aria-hidden="true">💧</span>Tưới {five}</button>
          )}
        </div>
      )}
      {owned.length > 1 && (
        <>
          <button className="btn sm ghost" aria-expanded={potOpen} onClick={() => setPotOpen((o) => !o)}>{potOpen ? "Xong" : "Đổi chậu"}</button>
          {potOpen && (
            <div role="radiogroup" aria-label="Chọn chậu" style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {owned.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={p.pot === x.id} aria-label={x.name} onClick={() => A.setPot(p.id, x.id)}
                  style={{ width: 52, height: 52, borderRadius: 12, border: `2.5px solid ${p.pot === x.id ? "var(--ink)" : "var(--sand)"}`, background: p.pot === x.id ? "var(--coin-soft)" : "#fff", padding: 2 }}>
                  <svg viewBox="20 80 80 52" width={44} height={30} aria-hidden="true"><Pot id={x.id} /></svg>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- Vườn của con ---------- */
function MyGarden({ g }: { g: Garden }) {
  const { S, U, A } = useApp();
  const bank = waterBank(g);
  const ready = g.plants.some((p) => isRipe(p));
  const next = SLOT_PRICE[g.slots + 1];
  const others = S.members.filter((m) => m.role === "kid" && m.id !== U.member && S.gardens[m.id]);
  const say = ready ? "Có cây hái được rồi nè!" : bank > 0 ? `Con có ${bank} giọt nước, tưới cây nhé!` : "Làm thêm việc tốt để có nước tưới cây nhé!";

  return (
    <>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Pig mood="happy" size={72} level={1} />
        <div className="card grow" style={{ borderRadius: "18px 18px 18px 5px", marginBottom: 18, fontSize: 15, fontWeight: 800 }}>{say}</div>
      </div>
      <section className="card row water-card" aria-label="Bình nước">
        <span className="water-drop" aria-hidden="true">💧</span>
        <div className="grow">
          <b style={{ fontSize: 18 }}>{bank} giọt nước</b>
          <div className="muted" style={{ fontSize: 12 }}>Mỗi việc được gật đầu được 1 giọt, việc làm cùng bố mẹ được 2 giọt.</div>
        </div>
      </section>
      <div className="plots">
        {Array.from({ length: g.slots }, (_, i) => i + 1).map((slot) => {
          const p = g.plants.find((x) => x.slot === slot);
          return p ? <PlotCard key={p.id} g={g} p={p} /> : (
            <section key={slot} className="card stack plot empty" aria-label={`Ô ${slot} còn trống`} style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8, minHeight: 220, borderStyle: "dashed" }}>
              <Icon name="plus" size={30} strokeWidth={3} />
              <b>Ô {slot} còn trống</b>
              <button className="btn sm mint" onClick={() => A.gtab("shop")}>Chọn hạt giống</button>
            </section>
          );
        })}
        {next !== undefined && g.slots < MAX_SLOTS && (
          <section className="card stack plot empty" aria-label="Ô đất mới" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8, minHeight: 220, borderStyle: "dashed", opacity: 0.85 }}>
            <Icon name="star" size={28} strokeWidth={3} />
            <b>Ô đất mới</b>
            <span className="pill" style={{ background: "var(--coin-soft)" }}><Coin size={16} />{next} Ủn</span>
            <button className="btn sm" onClick={() => A.gtab("shop")}>Xem ở cửa hàng</button>
          </section>
        )}
      </div>
      {others.length > 0 && (
        <section className="card stack" aria-label="Vườn của các bạn" style={{ gap: 8 }}>
          <h3>Vườn của các bạn</h3>
          {others.map((m) => {
            const og = S.gardens[m.id];
            return (
              <div key={m.id} className="row" style={{ gap: 10 }}>
                <Avatar m={m} size={34} fs={14} />
                <div className="grow"><b>{m.name}</b><div className="muted" style={{ fontSize: 12 }}>{og.plants.length} cây · đã thu hoạch {og.plants.reduce((a, p) => a + p.harvests, 0)} lần</div></div>
                <div style={{ display: "flex", gap: 2 }}>
                  {og.plants.map((p) => <PlantArt key={p.id} species={p.species} stage={plantStage(p)} pot={p.pot} sad={isSad(p)} size={46} />)}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

/* ---------- Cửa hàng ---------- */
function Shop({ g }: { g: Garden }) {
  const { S, U, A } = useApp();
  const k = U.member!;
  const coins = S.coins[k] ?? 0;
  const left = capLeft(S, g);
  const slot = freeSlot(g);
  const nextSlot = SLOT_PRICE[g.slots + 1];

  return (
    <>
      <section className="card row" style={{ background: "var(--coin-soft)" }}>
        <Coin size={30} />
        <div className="grow">
          <b className="display" style={{ fontSize: 20 }}>{coins} Ủn</b>
          <div className="muted" style={{ fontSize: 12 }}>Tuần này con còn chi được {left} Ủn cho khu vườn</div>
        </div>
      </section>

      <h3>Hạt giống</h3>
      <div className="shop-list">
        {SPECIES.filter((s) => s.price > 0).map((s) => {
          const short = coins < s.price;
          return (
            <section key={s.id} className="card stack" aria-label={s.name} style={{ gap: 6 }}>
              <div className="row" style={{ gap: 10 }}>
                <PlantArt species={s.id} stage={3} size={70} label={`Hình ${s.name}`} />
                <div className="grow">
                  <b style={{ fontSize: 15 }}>{s.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{s.blurb}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="pill" style={{ background: "var(--sand)" }}>{SPEED_LABEL[s.speed]}</span>
                <span className="pill" style={{ background: "var(--sand)" }}>{finalStage(s) === 4 ? "Ra hoa" : "Ra quả"} sau {needOf(s)} giọt</span>
                <span className="pill" style={{ background: s.golden ? "var(--coin-soft)" : "var(--mint-soft)" }}>{harvestVerb(s)} +{s.fruit} Ủn</span>
              </div>
              <button className="btn sm mint" disabled={slot === null || short} onClick={() => slot !== null && A.buySeed(s.id, slot)}>
                {slot === null ? "Cần một ô trống" : short ? `Thiếu ${s.price - coins} Ủn` : <><Coin size={16} />{s.price} Ủn · Mua và trồng</>}
              </button>
            </section>
          );
        })}
      </div>

      {nextSlot !== undefined && g.slots < MAX_SLOTS && (
        <section className="card row" aria-label="Ô đất mới" style={{ gap: 10 }}>
          <Icon name="plus" size={28} strokeWidth={3} />
          <div className="grow"><b>Mở ô đất thứ {g.slots + 1}</b><div className="muted" style={{ fontSize: 12 }}>Thêm chỗ để trồng thêm một cây</div></div>
          <button className="btn sm" disabled={coins < nextSlot} onClick={() => A.buySlot()}><Coin size={16} />{nextSlot}</button>
        </section>
      )}

      <h3>Chậu</h3>
      <div className="shop-list">
        {POTS.filter((p) => p.price > 0).map((p) => {
          const own = g.items.includes(p.id);
          return (
            <section key={p.id} className="card row" aria-label={p.name} style={{ gap: 10 }}>
              <svg viewBox="20 80 80 52" width={64} height={42} aria-hidden="true"><Pot id={p.id} /></svg>
              <b className="grow" style={{ fontSize: 14 }}>{p.name}</b>
              {own ? <span className="pill" style={{ background: "var(--mint)" }}><Icon name="check" size={12} strokeWidth={3.6} />Đã có</span>
                : <button className="btn sm" disabled={coins < p.price} onClick={() => A.buyPot(p.id)}><Coin size={16} />{p.price}</button>}
            </section>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>Cây lớn nhờ nước từ việc tốt, không mua được. Ủn chỉ dùng để mua hạt giống, chậu và ô đất.</div>
    </>
  );
}

/* ---------- Khung tab Vườn ---------- */
export function GardenPage({ race }: { race: ReactNode }) {
  const { S, U, A } = useApp();
  const k = U.member!;
  const g = S.gardens[k];
  const tab = U.gtab;
  const [busy, setBusy] = useState(false);

  if (!S.settings.gardenEnabled) {
    return <Empty title="Khu vườn đang nghỉ" hint="Bố mẹ đã tạm tắt khu vườn. Con vẫn làm việc tốt bình thường nhé." />;
  }

  return (
    <>
      <div>
        <h2>Khu vườn Ủn</h2>
        <div className="muted" style={{ marginTop: 2 }}>Làm việc tốt để có nước, tưới cho cây lớn, ra hoa và ra quả.</div>
      </div>
      <div className="gv-tabs" role="tablist" aria-label="Khu vườn">
        {TABS.map((t) => (
          <button key={t.v} role="tab" aria-selected={tab === t.v} className={`btn sm ${tab === t.v ? "coin" : ""}`} onClick={() => A.gtab(t.v)}>{t.label}</button>
        ))}
      </div>

      {tab === "race" ? race : !g ? (
        <section className="card stack" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
          <Pig mood="happy" size={90} level={1} />
          <div className="display" style={{ fontSize: 20 }}>Con có muốn trồng vườn không?</div>
          <div className="muted" style={{ maxWidth: 320 }}>Con sẽ có sẵn một Cây Hy vọng miễn phí. Mỗi việc tốt được gật đầu cho con nước để tưới cây.</div>
          <button className="btn big mint" disabled={busy} onClick={async () => { setBusy(true); await A.startGarden(); setBusy(false); }}>
            <Icon name="plus" size={20} strokeWidth={3} />Bắt đầu trồng vườn
          </button>
        </section>
      ) : tab === "shop" ? <Shop g={g} /> : <MyGarden g={g} />}
    </>
  );
}

