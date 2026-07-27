"use client";

import {
  bgHex,
  getDoc,
  pxLabel,
  type BackgroundId,
  type DocSpec,
} from "@/lib/docs";
import type { Compliance } from "@/lib/checks";
import { CHECK_LABELS, type Copy, type Lang } from "@/lib/i18n";
import type { Working } from "@/lib/studio";
import { CropPreview } from "@/components/CropPreview";
import {
  BackBar,
  ErrorNote,
  GhostButton,
  PrimaryButton,
  Spinner,
  Toggle,
} from "@/components/ui";

export function Export({
  t,
  lang,
  workingFor,
  backgroundFor,
  headScaleOf,
  docs,
  primary,
  picked,
  onToggle,
  compliance,
  pendingCount,
  retouching,
  onRetouch,
  brightness,
  sheet,
  onSheet,
  sheetDocId,
  onSheetDoc,
  exporting,
  error,
  onBack,
  onExport,
}: {
  t: Copy;
  lang: Lang;
  /** Ảnh của đúng nhóm nền cho từng loại — nhiều nền là nhiều ảnh khác nhau */
  workingFor: (docId: string) => Working;
  backgroundFor: (spec: DocSpec) => BackgroundId;
  headScaleOf: (docId: string) => number;
  /** Chỉ những loại CÙNG HỌ với loại chính — trộn hai chế độ là bất khả */
  docs: DocSpec[];
  /** Loại đã chụp và canh cho — không cho bỏ tick */
  primary: string;
  picked: string[];
  onToggle: (id: string) => void;
  /** Kết luận cho tập ĐANG chọn — tính lại mỗi lần tick */
  compliance: Compliance | null;
  /** Số nhóm nền còn phải thay — tick thêm loại có thể sinh nhóm nền mới */
  pendingCount: number;
  retouching: boolean;
  onRetouch: () => void;
  brightness: number;
  sheet: boolean;
  onSheet: (v: boolean) => void;
  sheetDocId: string | null;
  onSheetDoc: (id: string) => void;
  exporting: boolean;
  error: string | null;
  onBack: () => void;
  onExport: () => void;
}) {
  const count = picked.length + (sheet ? 1 : 0);
  const sheetSpec = getDoc(sheetDocId ?? primary) ?? getDoc(primary)!;
  const fitOf = (docId: string) =>
    compliance?.fits.find((f) => f.docId === docId) ?? null;

  /**
   * Chỉ còn MỘT loại trượt cần nói.
   *
   * Trước đây phải tách "trượt vì loại vừa thêm khắt khe hơn" khỏi "trượt từ đầu",
   * vì tick lẫn LinkedIn với giấy tờ tuỳ thân làm đổi mức khắt khe. Chế độ tách ở
   * trang chủ khiến chuyện đó thành bất khả — mọi loại ở đây cùng một họ, nên mọi
   * tiêu chí trượt đều là trượt từ bước kiểm tra.
   */
  const failing = compliance?.checks.filter((c) => c.required && !c.pass) ?? [];

  return (
    <div className="screen-in scr flex h-full flex-col gap-4 overflow-auto bg-n900 px-5 pb-7 pt-9 text-n100">
      <BackBar onBack={onBack} title={t.exportTitle} />
      <p className="-mt-2 text-[12.5px] leading-normal text-n400">
        {t.exportSub}
      </p>

      <div className="flex flex-col">
        {docs.map((d) => {
          const on = picked.includes(d.id);
          const isPrimary = d.id === primary;
          const w = workingFor(d.id);
          const fit = on ? fitOf(d.id) : null;
          return (
            <button
              key={d.id}
              onClick={() => onToggle(d.id)}
              aria-pressed={on}
              disabled={isPrimary}
              className="flex items-center gap-3 border-b border-n800 px-0.5 py-2.5 text-left"
            >
              <span className="w-[34px] flex-none overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--color-neutral-700)]">
                <CropPreview
                  photo={w.photo}
                  landmarks={w.landmarks}
                  imgW={w.width}
                  imgH={w.height}
                  spec={d}
                  backgroundHex={bgHex(backgroundFor(d))}
                  headScale={headScaleOf(d.id)}
                  brightness={brightness}
                />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-bold">
                  {lang === "vi" ? d.vi : d.en}
                  {isPrimary ? (
                    <span className="pl-1.5 text-[10px] font-semibold uppercase tracking-wider text-a300">
                      {t.primaryTag}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10.5px] text-n500">{pxLabel(d)}</span>
                {!d.verified ? (
                  <span className="text-[10px] text-a300">{t.unverified}</span>
                ) : null}
                {/* Loại nào KHÔNG lấy được từ tấm ảnh này thì nói ngay ở dòng của
                    nó, đừng để người dùng xuất ra rồi mới đọc cảnh báo. */}
                {fit?.errors.length ? (
                  <span className="text-[10px] leading-snug text-a300">
                    {fit.errors[0]}
                  </span>
                ) : null}
                {fit && !fit.resolutionOk ? (
                  <span className="text-[10px] leading-snug text-a300">
                    {t.lowRes}
                  </span>
                ) : null}
              </span>
              <span
                className="grid h-6 w-6 flex-none place-items-center rounded-full text-[13px] font-bold"
                style={{
                  color: on ? "var(--color-accent-2-900)" : "transparent",
                  background: on ? "var(--color-accent-2-400)" : "transparent",
                  boxShadow: on
                    ? "none"
                    : "inset 0 0 0 1.5px var(--color-neutral-700)",
                }}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      {failing.length ? (
        <ErrorNote>
          <strong className="block pb-1">{t.stillFailing}</strong>
          {failing.map((c) => CHECK_LABELS[c.id]?.[lang] ?? c.id).join(", ")}
        </ErrorNote>
      ) : null}

      {/* Loại mới tick có thể đòi màu nền khác — cần thêm một lần thay nền nữa. */}
      {pendingCount > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-n800/70 px-3.5 py-3">
          <span className="text-[11.5px] leading-snug text-n300">
            {t.needMoreBg}
          </span>
          {retouching ? (
            <Spinner label={t.applying} />
          ) : (
            <GhostButton onClick={onRetouch}>
              {pendingCount > 1 ? `${t.applyBg} (${pendingCount}×)` : t.applyBg}
            </GhostButton>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-3xl bg-bg p-4 text-ink">
        <Toggle
          on={sheet}
          onChange={onSheet}
          label={t.sheetTitle}
          sub={t.sheetSub}
        />
        {sheet ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {picked.map((id) => {
                const d = getDoc(id);
                if (!d) return null;
                const on = d.id === sheetSpec.id;
                return (
                  <button
                    key={id}
                    onClick={() => onSheetDoc(id)}
                    className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
                      on
                        ? "bg-n900 text-n100"
                        : "text-n700 shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]"
                    }`}
                  >
                    {lang === "vi" ? d.vi : d.en}
                  </button>
                );
              })}
            </div>
            <SheetPreview
              working={workingFor(sheetSpec.id)}
              spec={sheetSpec}
              backgroundHex={bgHex(backgroundFor(sheetSpec))}
              headScale={headScaleOf(sheetSpec.id)}
              brightness={brightness}
            />
          </>
        ) : null}
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="mt-auto pt-1">
        {exporting ? (
          <div className="grid place-items-center py-3">
            <Spinner label={t.exporting} />
          </div>
        ) : (
          <PrimaryButton onClick={onExport} disabled={picked.length === 0}>
            {lang === "vi" ? `Xuất ${count} tệp` : `Export ${count} files`}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

/**
 * Lưới xem trước tờ in. Số hàng/cột tính đúng như renderSheet ở server (khổ
 * 102×152mm, lề 4mm, khe 2mm) để người dùng không nhận file khác cái đã thấy.
 */
function SheetPreview({
  working,
  spec,
  backgroundHex,
  headScale,
  brightness,
}: {
  working: Working;
  spec: DocSpec;
  backgroundHex: string;
  headScale: number;
  brightness: number;
}) {
  const SHEET_W = 102;
  const SHEET_H = 152;
  const MARGIN = 4;
  const GUTTER = 2;
  const usableW = SHEET_W - MARGIN * 2;
  const usableH = SHEET_H - MARGIN * 2;
  const cols = Math.max(
    1,
    Math.floor((usableW + GUTTER) / (spec.widthMm + GUTTER))
  );
  const rows = Math.max(
    1,
    Math.floor((usableH + GUTTER) / (spec.heightMm + GUTTER))
  );
  const gridW = cols * spec.widthMm + (cols - 1) * GUTTER;
  const gridH = rows * spec.heightMm + (rows - 1) * GUTTER;
  const originX = (SHEET_W - gridW) / 2;
  const originY = (SHEET_H - gridH) / 2;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[2px] bg-white shadow-[inset_0_0_0_1px_var(--color-neutral-400)]"
      style={{ aspectRatio: `${SHEET_W} / ${SHEET_H}` }}
    >
      {Array.from({ length: cols * rows }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <div
            key={i}
            className="absolute"
            style={{
              width: `${(spec.widthMm / SHEET_W) * 100}%`,
              height: `${(spec.heightMm / SHEET_H) * 100}%`,
              left: `${((originX + col * (spec.widthMm + GUTTER)) / SHEET_W) * 100}%`,
              top: `${((originY + row * (spec.heightMm + GUTTER)) / SHEET_H) * 100}%`,
            }}
          >
            <CropPreview
              photo={working.photo}
              landmarks={working.landmarks}
              imgW={working.width}
              imgH={working.height}
              spec={spec}
              backgroundHex={backgroundHex}
              headScale={headScale}
              brightness={brightness}
              className="h-full w-full"
            />
            <PreviewCropMarks />
          </div>
        );
      })}
    </div>
  );
}

/** Dấu góc xem trước — nằm ngoài ảnh, cùng nguyên tắc với bản JPG 300dpi. */
function PreviewCropMarks() {
  // Preview chỉ rộng khoảng 300px nên nét cần đậm hơn bản in 300dpi một chút
  // để người dùng vẫn nhận ra dấu cắt sau khi thu nhỏ.
  const horizontal = "absolute z-20 h-px w-[6px] bg-n700/80";
  const vertical = "absolute z-20 h-[6px] w-px bg-n700/80";

  return (
    <span className="pointer-events-none absolute inset-0 z-20">
      <span className={`${horizontal} -left-[7px] top-0`} />
      <span className={`${vertical} -top-[7px] left-0`} />
      <span className={`${horizontal} -right-[7px] top-0`} />
      <span className={`${vertical} -top-[7px] right-0`} />
      <span className={`${horizontal} -left-[7px] bottom-0`} />
      <span className={`${vertical} -bottom-[7px] left-0`} />
      <span className={`${horizontal} -right-[7px] bottom-0`} />
      <span className={`${vertical} -bottom-[7px] right-0`} />
    </span>
  );
}
