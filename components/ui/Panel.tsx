import { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  glow?: boolean;
  noPadding?: boolean;
}

export default function Panel({
  elevated,
  glow,
  noPadding,
  children,
  className = "",
  style,
  ...props
}: PanelProps) {
  return (
    <div
      className={[
        "rounded-xl transition-all duration-200",
        noPadding ? "" : "p-5 md:p-6",
        glow ? "shadow-[0_0_25px_rgba(251,86,7,0.15)]" : "shadow-md",
        className,
      ].join(" ")}
      style={{
        background: elevated ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: glow ? "1px solid var(--accent)" : "1px solid var(--border-default)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
