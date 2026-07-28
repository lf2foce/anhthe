"use client";

/**
 * Mảnh giao diện dùng lại giữa các màn — ngôn ngữ "pop": viền mực 2px + bóng
 * lệch cứng, nền sáng, 5 màu kẹo. Đổi ở đây là cả app đổi theo — các màn chỉ
 * được thêm màu qua token pop, không tự chế thang màu riêng.
 *
 * Prop `dark` ở vài mảnh vẫn giữ: Studio sáng tạo và sân khấu soi ảnh còn nền
 * tối — nền tối là ĐÚNG cho việc xem ảnh, không phải đồ cũ chưa dọn.
 */

import type { ReactNode } from "react";

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-pink">
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
            : "border-2 border-pop-ink bg-white text-pop-ink"
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
        {sub ? <span className="text-[11px] text-pop-ink/50">{sub}</span> : null}
      </span>
      <span
        className="flex h-[26px] w-11 flex-none items-center rounded-full border-2 border-pop-ink p-[2px] transition-all duration-150"
        style={{
          background: on ? "var(--color-mint)" : "var(--color-pop-bg)",
          justifyContent: on ? "flex-end" : "flex-start",
        }}
      >
        <span className="h-[18px] w-[18px] rounded-full border-2 border-pop-ink bg-white" />
      </span>
    </button>
  );
}

export function Dot({ ok, size = 22 }: { ok: boolean; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-full border-2 border-pop-ink font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: ok ? "var(--color-mint)" : "var(--color-pink)",
      }}
    >
      {ok ? "✓" : "!"}
    </span>
  );
}

/** Vòng điểm n/8 — conic-gradient, mint trên nền giấy */
export function ScoreRing({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div
      className="relative grid h-[104px] w-[104px] flex-none place-items-center rounded-full border-2 border-pop-ink"
      style={{
        background: `conic-gradient(var(--color-mint) 0 ${pct}%, var(--color-mint-1) ${pct}% 100%)`,
      }}
    >
      <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-pop-ink bg-white">
        <span className="font-display text-[30px] font-bold leading-none">
          {value}
        </span>
        <span className="text-[10px] text-pop-ink/50">/ {total}</span>
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
    accent: "bg-viol text-white",
    ink: "bg-pop-ink text-white",
    cream: "bg-white text-pop-ink",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full border-2 border-pop-ink px-4 py-[15px] text-[14.5px] font-bold shadow-[3px_3px_0_var(--color-pop-ink)] ${tones[tone]}`}
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
      className={`w-full rounded-full px-[18px] py-3.5 text-[13px] font-bold ${
        dark
          ? "text-n300 shadow-[inset_0_0_0_1.5px_var(--color-neutral-700)]"
          : "border-2 border-pop-ink bg-white text-pop-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-pink bg-pink-1 px-3.5 py-3 text-[12px] leading-snug text-pop-ink">
      {children}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  // Màu chữ + vòng theo currentColor: spinner sống cả trên nền sáng lẫn nền
  // tối của Studio sáng tạo mà không cần prop dark.
  return (
    <div className="flex items-center gap-2.5 text-[12.5px] opacity-75">
      <span
        className="h-4 w-4 flex-none animate-spin rounded-full border-2"
        style={{
          borderColor: "color-mix(in srgb, currentColor 25%, transparent)",
          borderTopColor: "var(--color-viol)",
        }}
      />
      {label}
    </div>
  );
}
