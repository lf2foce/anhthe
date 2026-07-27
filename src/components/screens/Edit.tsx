"use client";

import { BACKGROUNDS, getDoc, type BackgroundId, type DocSpec } from "@/lib/docs";
import { computeCrop } from "@/lib/geometry";
import type { Copy, Lang } from "@/lib/i18n";
import type { Working } from "@/lib/studio";
import { CropPreview } from "@/components/CropPreview";
import { ErrorNote, GhostButton, PrimaryButton, Spinner, Toggle } from "@/components/ui";

export function Edit({
  t,
  lang,
  working,
  spec,
  picked,
  previewDocId,
  onPreviewDoc,
  bg,
  brightness,
  headScale,
  smooth,
  retouched,
  retouching,
  error,
  onBg,
  onBrightness,
  onHeadScale,
  onSmooth,
  onRetouch,
  onBack,
  onNext,
}: {
  t: Copy;
  lang: Lang;
  working: Working;
  spec: DocSpec;
  picked: string[];
  previewDocId: string;
  onPreviewDoc: (id: string) => void;
  bg: BackgroundId;
  brightness: number;
  headScale: number;
  smooth: boolean;
  retouched: boolean;
  retouching: boolean;
  error: string | null;
  onBg: (id: BackgroundId) => void;
  onBrightness: (v: number) => void;
  onHeadScale: (v: number) => void;
  onSmooth: (v: boolean) => void;
  onRetouch: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const fit = computeCrop(
    working.landmarks,
    working.width,
    working.height,
    spec,
    headScale
  );

  return (
    <div className="screen-in flex h-full flex-col bg-n900">
      <div className="relative h-[300px] flex-none overflow-hidden bg-n800">
        <div className="mx-auto h-full">
          <CropPreview
            photo={working.photo}
            landmarks={working.landmarks}
            imgW={working.width}
            imgH={working.height}
            spec={spec}
            headScale={headScale}
            brightness={brightness}
            guides
            crownLabel={t.crownLine}
            className="mx-auto h-full"
          />
        </div>
        <button
          onClick={onBack}
          aria-label={t.back}
          className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-n900/55 text-[15px] text-n100 backdrop-blur"
        >
          ←
        </button>
        <span className="absolute right-4 top-4 rounded-full bg-bg/80 px-2.5 py-1 text-[12.5px] font-bold text-ink">
          {lang === "vi" ? "đầu" : "head"} {(fit.headRatio * 100).toFixed(0)}%
        </span>
      </div>

      <div className="scr -mt-6 flex flex-1 flex-col gap-4 overflow-auto rounded-t-[30px] bg-bg px-5 pb-6 pt-5 text-ink">
        <span className="mx-auto -mt-2 h-1 w-11 rounded-full bg-n400" />

        {picked.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((id) => {
              const d = getDoc(id);
              if (!d) return null;
              const on = id === previewDocId;
              return (
                <button
                  key={id}
                  onClick={() => onPreviewDoc(id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
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
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-n600">
            {t.bgLabel}
          </span>
          <div className="flex gap-2.5">
            {BACKGROUNDS.map((b) => {
              const on = bg === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => onBg(b.id)}
                  className="relative flex flex-1 items-center gap-2 rounded-full px-2.5 py-2 shadow-[inset_0_0_0_1.5px_var(--color-neutral-300)]"
                >
                  <span
                    className="h-[18px] w-[18px] flex-none rounded-full shadow-[inset_0_0_0_1px_var(--color-neutral-400)]"
                    style={{ background: b.hex }}
                  />
                  <span className="text-[11px] font-semibold">
                    {lang === "vi" ? b.vi : b.en}
                  </span>
                  {on ? (
                    <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-[12px] font-semibold">
              <span>{t.bright}</span>
              <span className="text-a700">
                {brightness > 0 ? "+" : ""}
                {brightness}
              </span>
            </span>
            <input
              type="range"
              min={-30}
              max={30}
              value={brightness}
              onChange={(e) => onBrightness(Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-[12px] font-semibold">
              <span>{t.headRatio}</span>
              <span className="text-a700">
                {(fit.headRatio * 100).toFixed(0)}%
              </span>
            </span>
            <input
              type="range"
              min={85}
              max={115}
              value={Math.round(headScale * 100)}
              onChange={(e) => onHeadScale(Number(e.target.value) / 100)}
            />
            <span className="text-[10.5px] text-n600">
              {lang === "vi" ? "Giới hạn chuẩn " : "Allowed "}
              {(spec.headRatio.min * 100).toFixed(0)}–
              {(spec.headRatio.max * 100).toFixed(0)}%
            </span>
          </label>

          <Toggle on={smooth} onChange={onSmooth} label={t.smooth} />
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {retouching ? (
          <Spinner label={t.applying} />
        ) : retouched ? (
          <div className="flex items-center gap-2 text-[12px] font-semibold text-g700">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-g500 text-[11px] text-white">
              ✓
            </span>
            {t.bgDone}
          </div>
        ) : (
          <GhostButton onClick={onRetouch} dark={false}>
            {t.applyBg}
          </GhostButton>
        )}

        <p className="m-0 text-[11px] leading-snug text-g700">{t.editNote}</p>

        {fit.errors.length ? (
          <ul className="m-0 list-disc space-y-1 pl-4 text-[11px] leading-snug text-a700">
            {fit.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <PrimaryButton onClick={onNext} tone="ink" disabled={retouching}>
          {t.editCta}
        </PrimaryButton>
      </div>
    </div>
  );
}
