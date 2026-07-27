"use client";

import { useRef } from "react";
import { DOCS } from "@/lib/docs";
import type { Copy, Lang } from "@/lib/i18n";
import { Kicker } from "@/components/ui";

export function Home({
  t,
  lang,
  picked,
  onToggle,
  onShoot,
  onUpload,
}: {
  t: Copy;
  lang: Lang;
  picked: string[];
  onToggle: (id: string) => void;
  onShoot: () => void;
  onUpload: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const n = picked.length;

  return (
    <div className="screen-in scr relative flex h-full flex-col gap-4 overflow-auto bg-n900 px-5 pb-8 pt-9 text-n100">
      <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-g800 opacity-50" />

      <div className="relative flex flex-col gap-2">
        <Kicker>{t.homeKicker}</Kicker>
        <h1 className="text-[34px] leading-[1.06] tracking-tight">
          {t.homeTitle}
        </h1>
        <p className="max-w-[30ch] text-[13.5px] leading-normal text-n400">
          {t.homeSub}
        </p>
      </div>

      <div className="flex items-baseline gap-2.5 pt-0.5">
        <span className="text-[12.5px] font-bold">{t.pickTitle}</span>
        <span className="h-px flex-1 bg-n700" />
        <span className="text-[10.5px] text-n500">{t.pickHint}</span>
      </div>

      <div className="flex flex-col">
        {DOCS.map((d) => {
          const on = picked.includes(d.id);
          return (
            <button
              key={d.id}
              onClick={() => onToggle(d.id)}
              aria-pressed={on}
              className="flex items-center gap-3 border-b border-n800 py-3 text-left"
            >
              <span
                className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full text-[13px] font-bold text-white"
                style={{
                  background: on ? "var(--color-accent)" : "transparent",
                  boxShadow: on
                    ? "none"
                    : "inset 0 0 0 1.5px var(--color-neutral-700)",
                }}
              >
                {on ? "✓" : ""}
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-bold leading-tight">
                  {lang === "vi" ? d.vi : d.en}
                </span>
                <span className="text-[11px] leading-tight text-n500">
                  {lang === "vi" ? d.noteVi : d.noteEn}
                </span>
              </span>
              <span className="whitespace-nowrap text-[11px] font-semibold text-a300">
                {d.dim}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-3.5 pt-2.5">
        <button
          onClick={onShoot}
          disabled={n === 0}
          className="grid h-[86px] w-[86px] flex-none place-items-center rounded-full bg-accent text-[32px] text-white shadow-lg"
          aria-label={t.ctaShoot}
        >
          ◉
        </button>
        <div className="flex flex-1 flex-col gap-2">
          <button
            onClick={onShoot}
            disabled={n === 0}
            className="rounded-full py-3 text-[13px] font-semibold text-n200 shadow-[inset_0_0_0_1.5px_var(--color-neutral-700)]"
          >
            {t.ctaShoot}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={n === 0}
            className="text-left text-[11.5px] font-semibold text-a300 underline underline-offset-2"
          >
            {t.ctaUpload}
          </button>
          <span className="pl-0.5 text-[11px] text-n500">
            {n === 0
              ? t.pickNone
              : lang === "vi"
                ? `${n} loại đã chọn`
                : `${n} selected`}
          </span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onUpload(f);
        }}
      />
    </div>
  );
}
