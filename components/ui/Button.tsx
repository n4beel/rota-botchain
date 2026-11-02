"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "duty";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    border: "1px solid var(--accent)",
  },
  duty: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    border: "2px solid #FFF",
    boxShadow: "0 0 20px rgba(251, 86, 7, 0.4)",
  },
  secondary: {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-subtle)",
  },
  danger: {
    background: "rgba(255, 180, 160, 0.15)",
    color: "var(--danger)",
    border: "1px solid var(--danger)",
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs font-semibold rounded-md",
  md: "px-5 py-2.5 text-sm font-bold rounded-lg",
  lg: "px-6 py-3.5 text-base font-extrabold rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2",
          "font-sans uppercase tracking-wider transition-all duration-150",
          "cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none",
          sizeClasses[size],
          className,
        ].join(" ")}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
