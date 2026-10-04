import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  color?: "white" | "orange" | "mint" | "coin" | "pink" | "purple";
  size?: "sm" | "md" | "big";
  ghost?: boolean;
};

const COLORS = {
  white: "bg-white",
  orange: "bg-orange",
  mint: "bg-mint",
  coin: "bg-coin",
  pink: "bg-pink",
  purple: "bg-purple-btn",
};

const SIZES = {
  sm: "!min-h-10 !px-3 !py-1 !text-[15px] !rounded-xl !shadow-hard-sm",
  md: "",
  big: "!min-h-16 !text-[21px] !rounded-[20px] w-full",
};

export function Button({ color = "white", size = "md", ghost, className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`btn ${COLORS[color]} ${SIZES[size]} ${ghost ? "!shadow-none border-dashed" : ""} ${className}`}
      {...rest}
    />
  );
}
