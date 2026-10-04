export type PigMood = "happy" | "joy" | "sleep" | "judge";

/** Linh vật Ủn – heo đất. 4 trạng thái: happy, joy, sleep, judge */
export function Pig({ mood = "happy", size = 110, className }: { mood?: PigMood; size?: number; className?: string }) {
  const eyes = {
    happy: (
      <>
        <circle cx="40" cy="46" r="5" fill="#3B2A1A" stroke="none" />
        <circle cx="80" cy="46" r="5" fill="#3B2A1A" stroke="none" />
        <circle cx="42" cy="44" r="1.7" fill="#fff" stroke="none" />
        <circle cx="82" cy="44" r="1.7" fill="#fff" stroke="none" />
      </>
    ),
    joy: <path d="M34 47q6-8 12 0M74 47q6-8 12 0" fill="none" />,
    sleep: <path d="M34 46q6 6 12 0M74 46q6 6 12 0" fill="none" />,
    judge: (
      <>
        <circle cx="40" cy="46" r="11" fill="#fff" />
        <circle cx="80" cy="46" r="11" fill="#fff" />
        <path d="M51 46h18" fill="none" />
        <circle cx="41" cy="47" r="4" fill="#3B2A1A" stroke="none" />
        <circle cx="81" cy="47" r="4" fill="#3B2A1A" stroke="none" />
      </>
    ),
  }[mood];

  return (
    <svg width={size} height={Math.round((size * 110) / 120)} viewBox="0 0 120 110" aria-hidden="true" className={className}>
      <g stroke="#3B2A1A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M28 30L20 6l26 15z" fill="#FF8FB8" />
        <path d="M92 30l8-24-26 15z" fill="#FF8FB8" />
        {mood === "joy" && <path d="M14 52L2 34M106 52l12-18" fill="none" />}
        {mood !== "sleep" && (
          <>
            <rect x="34" y="86" width="14" height="18" rx="6" fill="#FF8FB8" />
            <rect x="72" y="86" width="14" height="18" rx="6" fill="#FF8FB8" />
          </>
        )}
        <ellipse cx="60" cy="58" rx="48" ry="40" fill="#FFA8C8" />
        <rect x="50" y="17" width="20" height="6" rx="3" fill="#3B2A1A" />
        <ellipse cx="60" cy="67" rx="18" ry="13" fill="#FF6FA3" />
        <ellipse cx="54" cy="67" rx="3" ry="4.5" fill="#3B2A1A" stroke="none" />
        <ellipse cx="66" cy="67" rx="3" ry="4.5" fill="#3B2A1A" stroke="none" />
        {eyes}
        {mood === "joy" && <path d="M52 86q8 7 16 0" fill="#fff" />}
        <ellipse cx="28" cy="61" rx="7" ry="4" fill="#FF6FA3" stroke="none" />
        <ellipse cx="92" cy="61" rx="7" ry="4" fill="#FF6FA3" stroke="none" />
      </g>
    </svg>
  );
}
