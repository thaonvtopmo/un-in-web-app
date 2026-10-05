"use client";

import { useState } from "react";
import { Coin } from "@/components/Coin";
import { PlantArt } from "@/components/Plant";
import { SPECIES, STAGE_NAMES, isSad, plantStage, progressOf, speciesOf, waterBank } from "@/lib/garden";
import { useApp } from "@/lib/store";
import { Avatar, Empty } from "./common";

/** Góc bố mẹ: xem khu vườn của các con và chỉnh cài đặt (bật/tắt, trần chi tiêu mỗi tuần) */
export function GardensTab() {
  const { S, A } = useApp();
  const kids = S.members.filter((m) => m.role === "kid");
  const [enabled, setEnabled] = useState(S.settings.gardenEnabled);
  const [cap, setCap] = useState(String(S.settings.gardenCap));
  const [busy, setBusy] = useState(false);
  const capNum = Number(cap.replace(/\D/g, "")) || 0;
  const dirty = enabled !== S.settings.gardenEnabled || capNum !== S.settings.gardenCap;

  async function save() {
    setBusy(true);
    await A.saveGardenSettings(enabled, capNum);
    setBusy(false);
  }

  return (
    <div className="parent-grid">
      <section className="card stack" aria-label="Cài đặt khu vườn">
        <h3>Khu vườn của các con</h3>
        <div className="muted">Các con trồng cây bằng nước kiếm được từ việc tốt, mua hạt giống, chậu và ô đất bằng Ủn. Cây lớn nhờ công sức, không mua được.</div>
        <label className="lbl check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật khu vườn cho các con
        </label>
        <label className="lbl">Trần chi tiêu mỗi tuần (Ủn)
          <input className="field" name="gardenCap" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
          <span className="muted" style={{ fontSize: 12 }}>Mặc định 300 Ủn. Chi cho vườn vượt mức này, con phải chờ tuần sau, để vẫn dành Ủn cho phiếu đi chơi lớn. Hạt giống {SPECIES.filter((s) => s.price > 0).map((s) => s.price).join(", ")} Ủn.</span>
        </label>
        <button className="btn mint" disabled={!dirty || busy} onClick={save}>{busy ? "Đang lưu..." : "Lưu cài đặt vườn"}</button>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        {kids.length === 0 && <Empty title="Chưa có bé nào" hint="Thêm bé ở tab Thành viên để các con có khu vườn." />}
        {kids.map((m) => {
          const g = S.gardens[m.id];
          return (
            <section key={m.id} className="card stack" aria-label={`Vườn của ${m.name}`} style={{ gap: 8 }}>
              <div className="row" style={{ gap: 10 }}>
                <Avatar m={m} size={38} fs={15} />
                <div className="grow">
                  <b>{m.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {g ? `${g.plants.length}/${g.slots} ô có cây · ${waterBank(g)} giọt nước chưa tưới · đã thu hoạch ${g.plants.reduce((a, p) => a + p.harvests, 0)} lần` : "Chưa bắt đầu chơi vườn"}
                  </div>
                </div>
                {g && <span className="pill" style={{ background: "var(--coin-soft)" }}><Coin size={16} />{g.spentWeek}/{S.settings.gardenCap} tuần này</span>}
              </div>
              {g && g.plants.length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {g.plants.map((p) => {
                    const sp = speciesOf(p.species);
                    const st = plantStage(p);
                    return (
                      <div key={p.id} style={{ display: "grid", justifyItems: "center", gap: 2, width: 96 }}>
                        <PlantArt species={p.species} stage={st} pot={p.pot} sad={isSad(p)} size={84} />
                        <b style={{ fontSize: 12, textAlign: "center" }}>{sp.name}</b>
                        <span className="muted" style={{ fontSize: 11 }}>{STAGE_NAMES[st]} · {progressOf(p)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {g && g.items.length > 0 && <div className="muted" style={{ fontSize: 12 }}>Đã mua {g.items.length} chậu.</div>}
            </section>
          );
        })}
      </section>
    </div>
  );
}
