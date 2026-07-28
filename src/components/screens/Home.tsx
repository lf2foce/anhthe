"use client";

import { useRef } from "react";
import type { DocSpec } from "@/lib/docs";
import type { Copy, Lang } from "@/lib/i18n";

/**
 * Màn Home trong app — redesign "tươi trẻ, nhiều màu" (đợt 1, cùng ngôn ngữ với
 * landing): nền sáng ấm, thẻ viền mực + bóng lệch cứng, mỗi loại giấy tờ một
 * viên màu. Các màn sau của luồng đổi da ở đợt sau.
 */

/** Bóng lệch cứng — cùng chữ ký với landing */
const POP = "shadow-[3px_3px_0_var(--color-pop-ink)]";

/** Mỗi loại giấy tờ một màu, xoay vòng — trùng bảng với landing */
const TINTS = [
  { bg: "bg-viol-1", dot: "bg-viol" },
  { bg: "bg-pink-1", dot: "bg-pink" },
  { bg: "bg-mint-1", dot: "bg-mint" },
  { bg: "bg-sun-1", dot: "bg-sun" },
  { bg: "bg-sky-1", dot: "bg-sky" },
] as const;

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
    // Bề ngang theo NỘI DUNG chứ không theo một cột 600px cứng: desktop trước
    // đây thừa hai mảng trống hai bên còn nội dung thì dồn thành cột hẹp dài.
    // Không còn bóng bay nội bộ — shell đã có, thêm ở đây thì bị mép container
    // cắt thành một vệt màu vô nghĩa (đã dính).
    <div className="[&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[880px] screen-in scr relative flex h-full flex-col gap-4 overflow-auto bg-pop-bg px-5 pb-4 pt-5 font-body text-pop-ink">
      <div className="flex flex-col gap-2.5">
        <span
          className={`w-fit -rotate-2 rounded-full border-2 border-pop-ink bg-pink px-3 py-1 text-[10.5px] font-bold text-white ${POP}`}
        >
          {t.homeKicker}
        </span>
        {/* Không lặp lời landing: câu "chỉ cần bức tường sáng..." đã nói ở đó,
            vào tới đây là lúc LÀM chứ không phải lúc thuyết phục nữa. */}
        <h1 className="font-display text-[32px] font-bold leading-[1.05] tracking-tight">
          {t.homeTitle}
        </h1>
      </div>

      {/* Hai luồng, chọn TRƯỚC mọi thứ khác: ảnh thẻ (compliance, sửa tối thiểu)
          vs studio sáng tạo (AI vẽ lại tự do) — hai cửa vào, không phải một tuỳ
          chọn giấu trong luồng. */}
      <button
        onClick={onCreative}
        className={`relative flex items-center gap-3 rounded-2xl border-2 border-pop-ink px-3.5 py-3 text-left text-white ${POP}`}
        style={{
          background:
            "linear-gradient(120deg, var(--color-viol), var(--color-pink))",
        }}
      >
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-white/70 text-[16px]">
          ✨
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13.5px] font-bold leading-tight">
            {t.flowCreativeTitle}
          </span>
          <span className="truncate text-[11px] leading-tight text-white/80">
            {t.flowCreativeSub}
          </span>
        </span>
        <span className="flex-none text-[16px]">→</span>
      </button>

      <div className="flex items-baseline gap-2.5 pt-1">
        <span className="text-[12.5px] font-bold">{t.pickTitle}</span>
        <span className="h-[2px] flex-1 rounded bg-pop-ink/10" />
        <span className="text-[10.5px] text-pop-ink/50">{t.pickHint}</span>
      </div>

      {/* Mỗi loại một THẺ màu; chọn = viền mực + bóng cứng, không phải một chấm
          radio bé — trên màn chạm, cả thẻ là nút. Màn rộng xếp 2 cột cho danh
          sách ngắn lại, đỡ phải cuộn mới thấy nút chụp. */}
      {/* grid-cols-1 TƯỜNG MINH: không khai cột thì track ngầm định là `auto`
          (min-content) — chip nowrap + từ dài trong tên loại banh thẻ ra 400px
          trên màn 390 (đo được). grid-cols-* của Tailwind = minmax(0,1fr). */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {docs.map((d, i) => {
          const on = d.id === primary;
          const tint = TINTS[i % TINTS.length];
          return (
            <button
              key={d.id}
              onClick={() => onPick(d.id)}
              role="radio"
              aria-checked={on}
              className={`flex items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-transform ${
                on
                  ? `border-pop-ink ${tint.bg} ${POP}`
                  : "border-pop-ink/15 bg-white"
              }`}
            >
              <span
                className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 border-pop-ink text-[10px] font-bold text-white ${
                  on ? tint.dot : "bg-white"
                }`}
              >
                {on ? "✓" : ""}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13.5px] font-bold leading-tight">
                  {lang === "vi" ? d.vi : d.en}
                </span>
                <span className="truncate text-[10.5px] leading-tight text-pop-ink/55">
                  {lang === "vi" ? d.noteVi : d.noteEn}
                </span>
              </span>
              <span
                className={`flex-none whitespace-nowrap rounded-full border-2 border-pop-ink px-2 py-0.5 text-[10.5px] font-bold ${
                  on ? "bg-white" : tint.bg
                }`}
              >
                {d.dim}
              </span>
            </button>
          );
        })}
      </div>

      {/* MỘT lời kêu gọi chính, phụ là đường viền. Màn rộng cho hai nút đứng
          cạnh nhau — đỡ một tầng cuộn nữa. */}
      <div className="mt-auto flex flex-col gap-2.5 pt-3">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            onClick={onShoot}
            className={`flex flex-1 items-center justify-center gap-2.5 rounded-full border-2 border-pop-ink bg-viol py-4 text-[15px] font-bold text-white ${POP}`}
          >
            <span className="text-[19px] leading-none">◉</span>
            {t.ctaShoot}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-full border-2 border-pop-ink bg-white px-6 py-4 text-[13px] font-bold sm:flex-none"
          >
            {t.ctaUpload}
          </button>
        </div>
        <span className="text-center text-[11px] leading-snug text-pop-ink/50">
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
