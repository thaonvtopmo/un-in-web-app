import { potOf, speciesOf, type Species } from "@/lib/garden";
import type { PotId, SpeciesId } from "@/lib/types";

/**
 * Hình vẽ cây theo loài và giai đoạn (0 hạt ... 4 ra hoa, 5 ra quả; loài chỉ ra hoa dừng ở 4), cùng nét viền nâu như heo Ủn.
 * Khung vẽ 120 x 130, gốc cây ở (60, 90).
 */
const INK = "#3B2A1A";
const stroke = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Leaf({ x, y, r, s = 1, c }: { x: number; y: number; r: number; s?: number; c: string }) {
  return <ellipse cx={x} cy={y} rx={9 * s} ry={4.6 * s} transform={`rotate(${r} ${x} ${y})`} fill={c} {...stroke} strokeWidth={2} />;
}

function Fruit({ x, y, c, gold }: { x: number; y: number; c: string; gold?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={6} fill={c} {...stroke} strokeWidth={2} />
      <circle cx={x - 2} cy={y - 2} r={1.6} fill="#fff" opacity={0.8} />
      {gold && <path d={`M${x - 3} ${y - 7}h6`} {...stroke} strokeWidth={2} />}
    </g>
  );
}

/** Cây thân thảo: Hy vọng, Chăm chỉ (hướng dương), Ngoan ngoãn (hoa cúc) */
function Leafy({ sp, stage }: { sp: Species; stage: number }) {
  const top = [90, 84, 66, 48, 40, 40][stage];
  const flowerAt = { x: 60, y: top - 6 };
  const petals = sp.id === "cham_chi" ? 12 : sp.id === "ngoan" ? 8 : 5;
  return (
    <g>
      {stage === 0 && (<><ellipse cx={60} cy={82} rx={9} ry={4.5} fill="#8B5A2B" {...stroke} strokeWidth={2} /><circle cx={58} cy={80.6} r={1.4} fill="#fff" opacity={0.7} /></>)}
      {stage >= 1 && <path d={`M60 90 V${top}`} stroke={sp.leaf} strokeWidth={5} strokeLinecap="round" fill="none" />}
      {stage >= 1 && <path d={`M60 90 V${top}`} stroke={INK} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.35} />}
      {stage === 1 && (<><Leaf x={52} y={top + 2} r={-25} c={sp.leaf} /><Leaf x={68} y={top + 2} r={25} c={sp.leaf} /></>)}
      {stage >= 2 && (<><Leaf x={50} y={top + 16} r={-28} c={sp.leaf} /><Leaf x={70} y={top + 12} r={28} c={sp.leaf} /></>)}
      {stage >= 2 && stage <= 3 && (<><Leaf x={52} y={top + 2} r={-20} c={sp.leaf} s={0.9} /><Leaf x={68} y={top + 2} r={20} c={sp.leaf} s={0.9} /></>)}
      {stage >= 3 && (<><Leaf x={47} y={top + 28} r={-32} c={sp.leaf} s={1.2} /><Leaf x={73} y={top + 26} r={32} c={sp.leaf} s={1.2} /></>)}
      {stage >= 4 && (
        <g>
          {Array.from({ length: petals }, (_, i) => (
            <ellipse key={i} cx={flowerAt.x} cy={flowerAt.y - 11} rx={sp.id === "hy_vong" ? 4.5 : 3.6} ry={sp.id === "cham_chi" ? 7 : 6.5}
              transform={`rotate(${(360 / petals) * i} ${flowerAt.x} ${flowerAt.y})`} fill={sp.id === "ngoan" ? "#fff" : sp.accent} {...stroke} strokeWidth={1.6} />
          ))}
          <circle cx={flowerAt.x} cy={flowerAt.y} r={sp.id === "cham_chi" ? 8 : 5.5} fill={sp.id === "cham_chi" ? "#8B5A2B" : "#FFC93C"} {...stroke} strokeWidth={2} />
        </g>
      )}
      {stage >= 5 && (<><Fruit x={44} y={top + 22} c={sp.fruitColor} gold={sp.id === "hy_vong"} /><Fruit x={77} y={top + 18} c={sp.fruitColor} gold={sp.id === "hy_vong"} /><Fruit x={55} y={top + 36} c={sp.fruitColor} gold={sp.id === "hy_vong"} /></>)}
    </g>
  );
}

/** Tre: Kỷ luật */
function Bamboo({ sp, stage }: { sp: Species; stage: number }) {
  const stalks = [[], [[60, 74]], [[60, 62]], [[52, 52], [66, 46]], [[48, 46], [60, 36], [72, 44]], [[48, 46], [60, 36], [72, 44]]][stage] as [number, number][];
  return (
    <g>
      {stage === 0 && (<ellipse cx={60} cy={82} rx={9} ry={4.5} fill="#8B5A2B" {...stroke} strokeWidth={2} />)}
      {stalks.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 4} y={y} width={8} height={90 - y} rx={4} fill={sp.leaf} {...stroke} strokeWidth={2} />
          {[0.3, 0.6, 0.85].map((f) => <path key={f} d={`M${x - 4} ${y + (90 - y) * f}h8`} stroke={INK} strokeWidth={1.6} />)}
          {stage >= 2 && <ellipse cx={x + 9} cy={y + 6} rx={9} ry={3.6} transform={`rotate(-25 ${x + 9} ${y + 6})`} fill={sp.accent} {...stroke} strokeWidth={1.8} />}
          {stage >= 3 && <ellipse cx={x - 9} cy={y + 14} rx={9} ry={3.6} transform={`rotate(25 ${x - 9} ${y + 14})`} fill={sp.accent} {...stroke} strokeWidth={1.8} />}
        </g>
      ))}
      {stage >= 4 && <path d="M60 36l-3-8M60 36l3-8" stroke="#FF6FA3" strokeWidth={3} strokeLinecap="round" />}
      {stage >= 5 && stalks.map(([x, y], i) => <Fruit key={i} x={x + 12} y={y + 24} c={sp.fruitColor} />)}
    </g>
  );
}

/** Xương rồng: Dũng cảm */
function Cactus({ sp, stage }: { sp: Species; stage: number }) {
  const h = [0, 14, 24, 40, 46, 46][stage];
  const w = [0, 8, 11, 14, 15, 15][stage];
  const top = 90 - h;
  return (
    <g>
      {stage === 0 && (<ellipse cx={60} cy={82} rx={9} ry={4.5} fill="#8B5A2B" {...stroke} strokeWidth={2} />)}
      {stage >= 3 && <path d={`M${60 - w} ${top + 24} h-14 v-12`} stroke={INK} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      {stage >= 3 && <path d={`M${60 - w} ${top + 24} h-14 v-12`} stroke={sp.leaf} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      {stage >= 4 && <path d={`M${60 + w} ${top + 16} h14 v-12`} stroke={INK} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      {stage >= 4 && <path d={`M${60 + w} ${top + 16} h14 v-12`} stroke={sp.leaf} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      {stage >= 1 && (
        <g>
          <rect x={60 - w} y={top} width={w * 2} height={h + 2} rx={w} fill={sp.leaf} {...stroke} />
          {stage >= 2 && [-1, 1].map((d) => <path key={d} d={`M${60 + d * w * 0.4} ${top + 6}v${h - 10}`} stroke={INK} strokeWidth={1.2} opacity={0.35} />)}
          {stage >= 2 && [0.25, 0.5, 0.75].map((f) => <path key={f} d={`M${58} ${top + h * f}l-3-2M62 ${top + h * f}l3-2`} stroke="#fff" strokeWidth={1.4} />)}
        </g>
      )}
      {stage >= 4 && (<g><circle cx={60} cy={top - 3} r={6} fill={sp.accent} {...stroke} strokeWidth={2} /><circle cx={60} cy={top - 3} r={2} fill="#FFC93C" /></g>)}
      {stage >= 5 && (<><Fruit x={60 - w - 14} y={90 - h + 4} c={sp.fruitColor} /><Fruit x={60 + w + 14} y={90 - h - 6} c={sp.fruitColor} /></>)}
    </g>
  );
}

/** Sồi: Kiên nhẫn */
function Oak({ sp, stage }: { sp: Species; stage: number }) {
  const trunkTop = [90, 80, 68, 56, 52, 52][stage];
  const r = [0, 0, 11, 22, 26, 26][stage];
  return (
    <g>
      {stage === 0 && (<ellipse cx={60} cy={82} rx={9} ry={4.5} fill="#8B5A2B" {...stroke} strokeWidth={2} />)}
      {stage >= 1 && <path d={`M60 90 V${trunkTop}`} stroke={INK} strokeWidth={stage >= 3 ? 12 : 8} strokeLinecap="round" />}
      {stage >= 1 && <path d={`M60 90 V${trunkTop}`} stroke="#A9693B" strokeWidth={stage >= 3 ? 8 : 4.6} strokeLinecap="round" />}
      {stage === 1 && (<><Leaf x={52} y={trunkTop} r={-25} c={sp.leaf} /><Leaf x={68} y={trunkTop} r={25} c={sp.leaf} /></>)}
      {stage >= 2 && (
        <g>
          <circle cx={60} cy={trunkTop - r * 0.4} r={r} fill={sp.leaf} {...stroke} />
          {stage >= 3 && (<><circle cx={42} cy={trunkTop - r * 0.1} r={r * 0.62} fill={sp.leaf} {...stroke} /><circle cx={78} cy={trunkTop - r * 0.1} r={r * 0.62} fill={sp.leaf} {...stroke} /><circle cx={60} cy={trunkTop - r * 0.4} r={r - 1.5} fill={sp.leaf} /></>)}
          <circle cx={54} cy={trunkTop - r * 0.7} r={r * 0.22} fill={sp.accent} opacity={0.7} />
        </g>
      )}
      {stage >= 4 && [[48, 40], [66, 36], [72, 52], [54, 54]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.6} fill="#FFE08A" stroke={INK} strokeWidth={1.2} />)}
      {stage >= 5 && [[46, 44], [70, 40], [60, 58]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={5} ry={6} fill={sp.fruitColor} {...stroke} strokeWidth={2} />
          <path d={`M${x - 5.5} ${y - 3}h11`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <path d={`M${x - 5} ${y - 3}h10`} stroke="#A9693B" strokeWidth={2.4} strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

export function Pot({ id }: { id: PotId }) {
  const p = potOf(id);
  return (
    <g>
      <path d="M30 92 H90 L82 125 H38 Z" fill={p.body} {...stroke} />
      {id === "sao" && <path d="M60 99l3.4 7 7.6 1-5.5 5.3 1.3 7.5-6.8-3.6-6.8 3.6 1.3-7.5-5.5-5.3 7.6-1z" fill="#FFF3B0" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />}
      {id === "cau_vong" && (<><path d="M34 106h52" stroke="#FF6FA3" strokeWidth={5} /><path d="M35.5 113h49" stroke="#FFC93C" strokeWidth={5} /><path d="M37 120h46" stroke="#3DD6B5" strokeWidth={5} /></>)}
      {id === "hong" && <><circle cx={52} cy={108} r={3} fill="#fff" opacity={0.7} /><circle cx={68} cy={114} r={3} fill="#fff" opacity={0.7} /></>}
      {id === "xanh" && <path d="M40 108q8-6 16 0t16 0" stroke="#fff" strokeWidth={3} fill="none" opacity={0.75} />}
      <rect x={26} y={85} width={68} height={11} rx={5} fill={p.rim} {...stroke} />
      <ellipse cx={60} cy={90.5} rx={30} ry={3.4} fill="#6B4423" opacity={0.9} />
    </g>
  );
}

/** Cây trong chậu. `sad`: cây buồn (xám nhạt, không mất gì). `size`: chiều rộng (px). */
export function PlantArt({ species, stage, pot = "dat", sad = false, size = 120, label }: {
  species: SpeciesId; stage: number; pot?: PotId; sad?: boolean; size?: number; label?: string;
}) {
  const sp = speciesOf(species);
  const body =
    sp.id === "ky_luat" ? <Bamboo sp={sp} stage={stage} /> :
    sp.id === "dung_cam" ? <Cactus sp={sp} stage={stage} /> :
    sp.id === "kien_nhan" ? <Oak sp={sp} stage={stage} /> :
    <Leafy sp={sp} stage={stage} />;
  return (
    <svg viewBox="0 0 120 130" width={size} height={(size * 130) / 120} role="img" aria-label={label ?? `${sp.name}, giai đoạn ${stage + 1}${sad ? ", đang buồn" : ""}`}
      style={{ filter: sad ? "grayscale(0.55) brightness(0.97)" : undefined, overflow: "visible" }}>
      <ellipse cx={60} cy={126} rx={38} ry={4} fill="#3B2A1A" opacity={0.12} />
      <g transform={sad && stage >= 1 ? "rotate(-4 60 90)" : undefined}>{body}</g>
      <Pot id={pot} />
      {sad && <g><path d="M96 42q-6 8-3 12a4 4 0 0 0 7 0q3-4-4-12z" fill="#7FD1FF" stroke={INK} strokeWidth={1.6} /></g>}
    </svg>
  );
}
