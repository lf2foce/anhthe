"use client";

import { useRef } from "react";
import type { DocSpec } from "@/lib/docs";
import type { Copy, Lang } from "@/lib/i18n";
import { Kicker } from "@/components/ui";

export function Home({
  t,
  lang,
  docs,
  primary,
  onPick,
  onShoot,
  onUpload,
  onCreative,
}: {
  t: Copy;
  lang: Lang;
  /** Chỉ các loại giấy tờ tuỳ thân — luồng sáng tạo là màn RIÊNG, không phải doc */
  docs: DocSpec[];
  /** Loại giấy tờ sẽ chụp và canh cho — chọn MỘT */
  primary: string;
  onPick: (id: string) => void;
  onShoot: () => void;
  onUpload: (file: File) => void;
  /** Rẽ sang Studio sáng tạo — luồng thứ hai, tách hẳn */
  onCreative: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="[&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[600px] screen-in scr relative flex h-full flex-col gap-4 overflow-auto bg-n900 px-5 pb-8 pt-9 text-n100">
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

      {/* Hai luồng, chọn TRƯỚC mọi thứ khác: ảnh thẻ (compliance, sửa tối thiểu)
          vs studio sáng tạo (AI vẽ lại tự do). Chúng khác nhau ở chỗ căn bản nên
          là hai cửa vào, không phải một tuỳ chọn giấu trong luồng. */}
      {/* KHÔNG overflow-hidden ở đây: mô tả dài xuống dòng thì bị xén mất chữ.
          Chiều cao để tự nhiên theo nội dung. */}
      <button
        onClick={onCreative}
        className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left"
        style={{
          background: "linear-gradient(120deg, #43304b, #1f3a3d)",
          boxShadow: "inset 0 0 0 1.5px var(--color-neutral-700)",
        }}
      >
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-a400/90 text-[15px]">
          ✨
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-bold leading-tight">
            {t.flowCreativeTitle}
          </span>
          <span className="truncate text-[10.5px] leading-tight text-n400">
            {t.flowCreativeSub}
          </span>
        </span>
        <span className="flex-none text-[15px] text-n400">→</span>
      </button>

      <div className="flex items-baseline gap-2.5 pt-0.5">
        <span className="text-[12.5px] font-bold">{t.pickTitle}</span>
        <span className="h-px flex-1 bg-n700" />
        <span className="text-[10.5px] text-n500">{t.pickHint}</span>
      </div>

      <div className="flex flex-col">
        {docs.map((d) => {
          const on = d.id === primary;
          return (
            <button
              key={d.id}
              onClick={() => onPick(d.id)}
              role="radio"
              aria-checked={on}
              className="flex items-center gap-2.5 border-b border-n800 py-2.5 text-left"
            >
              <span
                className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full"
                style={{
                  boxShadow: on
                    ? "inset 0 0 0 5px var(--color-accent)"
                    : "inset 0 0 0 1.5px var(--color-neutral-700)",
                }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13.5px] font-bold leading-tight">
                  {lang === "vi" ? d.vi : d.en}
                </span>
                <span className="truncate text-[10.5px] leading-tight text-n500">
                  {lang === "vi" ? d.noteVi : d.noteEn}
                </span>
              </span>
              <span className="flex-none whitespace-nowrap text-[10.5px] font-semibold text-a300">
                {d.dim}
              </span>
            </button>
          );
        })}
      </div>

      {/* MỘT lời kêu gọi, không phải hai. Bản cũ đặt vòng tròn 86px cạnh một
          pill nói đúng cùng một câu — trên mobile vòng tròn là chỗ đặt ngón cái,
          nhưng trên màn rộng nó thành thừa và lệch hẳn. */}
      <div className="mt-auto flex flex-col gap-2.5 pt-3">
        <button
          onClick={onShoot}
          className="flex items-center justify-center gap-2.5 rounded-full bg-accent py-4 text-[15px] font-bold text-white shadow-lg"
        >
          <span className="text-[19px] leading-none">◉</span>
          {t.ctaShoot}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-full py-3 text-[13px] font-semibold text-n200 shadow-[inset_0_0_0_1.5px_var(--color-neutral-700)]"
        >
          {t.ctaUpload}
        </button>
        <span className="text-center text-[11px] leading-snug text-n500">
          {t.moreSizesLater}
        </span>
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
