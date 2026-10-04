/** Đồng "Ủn" – đơn vị xu trong game */
export function Coin({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#FFC93C" stroke="#3B2A1A" strokeWidth="2" />
      <path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#3B2A1A" />
    </svg>
  );
}

export function CoinPill({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`display inline-flex items-center gap-1.5 rounded-full border-[3px] border-ink bg-white py-1 pl-1 pr-3 text-xl shadow-hard-sm ${className}`}>
      <Coin size={26} />
      {amount} Ủn
    </span>
  );
}
