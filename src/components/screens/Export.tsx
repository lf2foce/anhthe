"use client";

import { DOCS, getDoc, pxLabel, type DocSpec } from "@/lib/docs";
import type { Copy, Lang } from "@/lib/i18n";
import type { Working } from "@/lib/studio";
import { CropPreview } from "@/components/CropPreview";
import {
  BackBar,
  ErrorNote,
  PrimaryButton,
  Spinner,
  Toggle,
} from "@/components/ui";

export function Export({
  t,
  lang,
  working,
  picked,
  onToggle,
  brightness,
  headScale,
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
  working: Working;
  picked: string[];
  onToggle: (id: string) => void;
  brightness: number;
  headScale: number;
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
  const sheetSpec = getDoc(sheetDocId ?? picked[0] ?? "") ?? getDoc("vn34")!;

  return (
    <div className="screen-in scr flex h-full flex-col gap-4 overflow-auto bg-n900 px-5 pb-7 pt-9 text-n100">
      <BackBar onBack={onBack} title={t.exportTitle} />
      <p className="-mt-2 text-[12.5px] leading-normal text-n400">
        {t.exportSub}
      </p>

      <div className="flex flex-col">
        {DOCS.map((d) => {
          const on = picked.includes(d.id);
          return (
            <button
              key={d.id}
              onClick={() => onToggle(d.id)}
              aria-pressed={on}
              className="flex items-center gap-3 border-b border-n800 px-0.5 py-2.5 text-left"
            >
              <span className="w-[34px] flex-none overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--color-neutral-700)]">
                <CropPreview
                  photo={working.photo}
                  landmarks={working.landmarks}
                  imgW={working.width}
                  imgH={working.height}
                  spec={d}
                  headScale={headScale}
                  brightness={brightness}
                />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-bold">
                  {lang === "vi" ? d.vi : d.en}
                </span>
                <span className="text-[10.5px] text-n500">{pxLabel(d)}</span>
                {!d.verified ? (
                  <span className="text-[10px] text-a300">{t.unverified}</span>
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
              working={working}
              spec={sheetSpec}
              headScale={headScale}
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
  headScale,
  brightness,
}: {
  working: Working;
  spec: DocSpec;
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
      className="relative w-full overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_var(--color-neutral-300)]"
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
              headScale={headScale}
              brightness={brightness}
              className="h-full w-full rounded-[2px] shadow-[0_0_0_1px_rgba(32,30,29,.12)]"
            />
          </div>
        );
      })}
    </div>
  );
}
