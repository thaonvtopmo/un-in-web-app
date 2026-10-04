import type { ElementType, HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  tone?: "white" | "mint" | "pink" | "purple" | "coin" | "sand";
};

const TONES = {
  white: "bg-white",
  mint: "bg-mint-soft",
  pink: "bg-pink-soft",
  purple: "bg-purple-soft",
  coin: "bg-coin-soft",
  sand: "bg-sand",
};

export function Card({ as: Tag = "div", tone = "white", className = "", ...rest }: Props) {
  return (
    <Tag
      className={`rounded-[20px] border-[3px] border-ink px-3.5 py-3 shadow-hard ${TONES[tone]} ${className}`}
      {...rest}
    />
  );
}
