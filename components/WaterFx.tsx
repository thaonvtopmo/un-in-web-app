/** Hiệu ứng tưới cây: bình nước nghiêng từ trên xuống, các giọt nước rơi vào cây. Chỉ để trang trí (ẩn với trình đọc màn hình). */
const INK = "#3B2A1A";

export function WaterFx({ drops = 4 }: { drops?: number }) {
  const n = Math.min(8, Math.max(3, drops + 2));
  return (
    <div className="fx" aria-hidden="true">
      <svg className="can" viewBox="0 0 70 54" width={70} height={54}>
        <path d="M14 18c-8 0-9 14 2 14" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <path d="M14 18c-8 0-9 14 2 14" fill="none" stroke="#7FD1FF" strokeWidth={1.8} strokeLinecap="round" />
        <rect x={12} y={14} width={34} height={28} rx={8} fill="#5BC0EB" stroke={INK} strokeWidth={2.5} />
        <path d="M18 20q6-3 12 0" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.7} />
        <path d="M44 34L60 20" stroke={INK} strokeWidth={7} strokeLinecap="round" />
        <path d="M44 34L60 20" stroke="#5BC0EB" strokeWidth={3.4} strokeLinecap="round" />
        <ellipse cx={62} cy={19} rx={5} ry={7} transform="rotate(40 62 19)" fill="#3A9BCB" stroke={INK} strokeWidth={2.2} />
        <circle cx={60.5} cy={19.5} r={0.9} fill="#fff" /><circle cx={63.5} cy={17.5} r={0.9} fill="#fff" /><circle cx={63} cy={21} r={0.9} fill="#fff" />
      </svg>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className="drop" style={{ ["--x" as string]: `${(i % 4) * 7 - 8}px`, ["--d" as string]: `${0.55 + i * 0.09}s` }} />
      ))}
    </div>
  );
}

/** Tia sáng nảy lên khi cây lên giai đoạn mới */
export function Sparkles() {
  const items = ["✨", "🌱", "⭐", "✨", "🌿", "⭐"];
  return (
    <div className="sparkles" aria-hidden="true">
      {items.map((e, i) => (
        <span key={i} style={{ ["--dx" as string]: `${(i - 2.5) * 22}px`, ["--dy" as string]: `${-40 - (i % 3) * 18}px`, animationDelay: `${i * 0.05}s` }}>{e}</span>
      ))}
    </div>
  );
}
