"use client";

/** Mảnh giao diện dùng lại giữa các màn — giữ đúng hình dáng của prototype. */

import type { ReactNode } from "react";

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-a300">
      {children}
    </span>
  );
}

export function BackBar({
  onBack,
  title,
  dark = true,
}: {
  onBack: () => void;
  title: string;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={onBack}
        aria-label="Quay lại"
        className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[15px] ${
          dark
            ? "text-n300 shadow-[inset_0_0_0_1.5px_var(--color-neutral-700)]"
            : "text-ink shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]"
        }`}
      >
        ←
      </button>
      <span className="font-display text-[21px] font-bold">{title}</span>
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  label,
  sub,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center justify-between gap-2.5 py-0.5 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-semibold">{label}</span>
        {sub ? <span className="text-[11px] text-n600">{sub}</span> : null}
      </span>
      <span
        className="flex h-[26px] w-11 flex-none items-center rounded-full p-[3px] transition-all duration-150"
        style={{
          background: on
            ? "var(--color-accent-2-600)"
            : "var(--color-neutral-400)",
          justifyContent: on ? "flex-end" : "flex-start",
        }}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)]" />
      </span>
    </button>
  );
}

export function Dot({ ok, size = 22 }: { ok: boolean; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        background: ok ? "var(--color-accent-2-500)" : "var(--color-accent)",
      }}
    >
      {ok ? "✓" : "!"}
    </span>
  );
}

/** Vòng điểm n/8 — conic-gradient như prototype */
export function ScoreRing({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div
      className="relative grid h-[104px] w-[104px] flex-none place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-accent-2-400) 0 ${pct}%, var(--color-neutral-800) ${pct}% 100%)`,
      }}
    >
      <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-n900">
        <span className="font-display text-[30px] font-bold leading-none text-g300">
          {value}
        </span>
        <span className="text-[10px] text-n500">/ {total}</span>
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "accent",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "accent" | "ink" | "cream";
}) {
  const tones = {
    accent: "bg-accent text-white",
    ink: "bg-n900 text-n100",
    cream: "bg-g100 text-g800",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full px-4 py-[15px] text-[14.5px] font-bold ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  dark = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full px-[18px] py-3.5 text-[13px] font-semibold ${
        dark
          ? "text-n300 shadow-[inset_0_0_0_1.5px_var(--color-neutral-700)]"
          : "text-ink shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]"
      }`}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-a900/60 px-3.5 py-3 text-[12px] leading-snug text-a200 shadow-[inset_0_0_0_1px_var(--color-accent-700)]">
      {children}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[12.5px] text-n400">
      <span className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-n700 border-t-accent" />
      {label}
    </div>
  );
}
