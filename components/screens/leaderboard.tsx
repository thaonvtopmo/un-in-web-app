"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { LeaderRow } from "@/lib/backend";
import { useApp } from "@/lib/store";

const MEDAL = ["#FFC93C", "#D9DEE5", "#E8A87C"];

/** Bảng xếp hạng Ủn các nhà trong tuần. Chỉ có tên gia đình và số liệu tổng, không có tên bé. */
export function FamilyLeaderboard() {
  const { S, A } = useApp();
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const weekTotal = Object.values(S.week).reduce((a, b) => a + b, 0);

  useEffect(() => {
    let alive = true;
    A.leaderboard()
      .then((r) => { if (alive) { setRows(r); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [A, weekTotal, S.settings.leaderboard]);

  return (
    <section className="stack" style={{ gap: 8 }}>
      <div>
        <h2>Bảng xếp hạng các nhà</h2>
        <div className="muted">Tuần này · xếp theo Ủn trung bình mỗi người, nên nhà nào cũng có cơ hội</div>
      </div>
      {!S.settings.leaderboard && (
        <div className="card" style={{ background: "var(--sand)" }}>
          Nhà mình đang ẩn khỏi bảng. Bố mẹ bật lại trong Góc bố mẹ → Cài đặt nhé.
        </div>
      )}
      {failed && <div className="card">Chưa tải được bảng xếp hạng, thử lại sau nhé.</div>}
      {!rows && !failed && <div className="card muted">Đang tải...</div>}
      {rows && rows.length === 0 && <div className="card">Chưa có nhà nào tham gia tuần này.</div>}
      {rows && rows.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          {rows.map((r, i) => {
            const prev = rows[i - 1];
            const gap = prev && r.rank - prev.rank > 1; // nhà mình nằm ngoài top
            return (
              <div key={r.rank}>
                {gap && <div className="muted" style={{ textAlign: "center", margin: "2px 0" }}>· · ·</div>}
                <div className="card row" style={{ padding: "8px 10px", background: r.mine ? "var(--coin-soft)" : "var(--white)" }} aria-current={r.mine ? "true" : undefined}>
                  <div className="avatar" style={{ width: 34, height: 34, fontSize: 15, background: MEDAL[r.rank - 1] ?? "var(--sand)" }}>
                    {r.rank <= 3 ? <Icon name="trophy" size={18} strokeWidth={2.4} /> : r.rank}
                  </div>
                  <div className="grow">
                    <div className="display" style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.rank <= 3 ? `#${r.rank} · ` : ""}{r.name}
                      {r.mine && <span className="pill" style={{ marginLeft: 6, background: "#fff", fontSize: 11, padding: "1px 8px" }}>Nhà mình</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>{r.weekCoins} Ủn · {r.members} người</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="display" style={{ fontSize: 18 }}>{r.avg}</div>
                    <div className="muted" style={{ fontSize: 11 }}>Ủn/người</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
