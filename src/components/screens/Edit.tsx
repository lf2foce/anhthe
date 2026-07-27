"use client";

import {
  BACKGROUNDS,
  bgHex,
  getDoc,
  type BackgroundGroup,
  type BackgroundId,
  type DocSpec,
} from "@/lib/docs";
import { computeCrop, extendToFit } from "@/lib/geometry";
import type { Copy, Lang } from "@/lib/i18n";
import type { Working } from "@/lib/studio";
import { CropPreview } from "@/components/CropPreview";
import { ErrorNote, GhostButton, PrimaryButton, Spinner, Toggle } from "@/components/ui";

export function Edit({
  t,
  lang,
  working,
  spec,
  bg,
  allowed,
  groups,
  pendingCount,
  failedBackgrounds,
  brightness,
  headScale,
  smooth,
  sharpen,
  retouching,
  error,
  onBg,
  onBrightness,
  onHeadScale,
  onSmooth,
  onSharpen,
  onRetouch,
  onRetryBg,
  onBack,
  onNext,
}: {
  t: Copy;
  lang: Lang;
  working: Working;
  /** Loại giấy tờ tấm ảnh được canh cho — màn này chỉ chỉnh cho đúng nó */
  spec: DocSpec;
  /** Nền đã resolve cho spec đang canh */
  bg: BackgroundId;
  /** Nền mà ít nhất một loại đang chọn cho phép */
  allowed: BackgroundId[];
  groups: BackgroundGroup[];
  pendingCount: number;
  /** Nhóm đã chạy thay nền nhưng đo ra nền VẪN sai màu */
  failedBackgrounds: BackgroundId[];
  brightness: number;
  headScale: number;
  smooth: boolean;
  sharpen: boolean;
  retouching: boolean;
  error: string | null;
  onBg: (id: BackgroundId) => void;
  onBrightness: (v: number) => void;
  onHeadScale: (v: number) => void;
  onSmooth: (v: boolean) => void;
  onSharpen: (v: boolean) => void;
  onRetouch: () => void;
  onRetryBg: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  // Cùng phép nới ảo với preview/evaluate/export — bốn nơi phải kể một câu chuyện.
  const plan = extendToFit(working.landmarks, working.width, working.height, [spec], {
    [spec.id]: headScale,
  });
  const fit = computeCrop(plan.landmarks, plan.width, plan.height, spec, headScale);
  const doneCount = groups.length - pendingCount;

  return (
    <div className="screen-in isolate flex h-full min-h-0 flex-col overflow-hidden bg-n900 lg:flex-row">
      <div className="relative z-10 h-[300px] flex-none overflow-hidden bg-n800 lg:h-full lg:min-w-0 lg:flex-1">
        <div className="mx-auto h-full">
          <CropPreview
            photo={working.photo}
            landmarks={working.landmarks}
            imgW={working.width}
            imgH={working.height}
            spec={spec}
            backgroundHex={bgHex(bg)}
            headScale={headScale}
            brightness={brightness}
            guides
            crownLabel={t.crownLine}
            className="mx-auto h-full"
          />
        </div>
        {/* Nút này nằm ĐÈ lên ảnh, nên nền mờ 55% biến nó thành vô hình trên ảnh
            sáng. Dùng nền đặc + viền sáng + đổ bóng để nổi trên mọi ảnh. */}
        <button
          onClick={onBack}
          aria-label={t.back}
          className="absolute left-3.5 top-3.5 grid h-10 w-10 place-items-center rounded-full bg-n900/85 text-[17px] font-bold text-n100 shadow-[0_2px_10px_rgba(0,0,0,.45)] ring-[1.5px] ring-n100/45 backdrop-blur-sm"
        >
          ←
        </button>
        <span className="absolute right-4 top-4 rounded-full bg-bg/80 px-2.5 py-1 text-[12.5px] font-bold text-ink">
          {lang === "vi" ? "đầu" : "head"} {(fit.headRatio * 100).toFixed(0)}%
        </span>
      </div>

      <div className="scr relative z-0 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[30px] bg-bg px-5 pb-6 pt-5 text-ink lg:w-[400px] lg:flex-none lg:rounded-l-[30px] lg:rounded-tr-none lg:pt-7">
        <span className="mx-auto h-1 w-11 flex-none rounded-full bg-n400 lg:hidden" />

        {/* Nói rõ đang canh cho loại nào. Thanh trượt tỉ lệ đầu dưới đây chỉ tác
            động lên loại này — các cỡ khác tự canh theo target riêng của chúng. */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-bold">
            {lang === "vi" ? spec.vi : spec.en}
          </span>
          <span className="text-[10.5px] text-n600">{spec.dim}</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-n600">
            {t.bgLabel}
          </span>
          <div className="flex gap-2.5">
            {BACKGROUNDS.map((b) => {
              // Nền nào không loại nào cho phép thì không bấm được — chuẩn giấy
              // tờ quyết định, không phải sở thích.
              const usable = allowed.includes(b.id);
              const on = bg === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => onBg(b.id)}
                  disabled={!usable}
                  aria-pressed={on}
                  className="relative flex flex-1 items-center gap-2 rounded-full px-2.5 py-2 shadow-[inset_0_0_0_1.5px_var(--color-neutral-300)] disabled:opacity-35"
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

          <p className="m-0 text-[10.5px] leading-snug text-n600">{t.bgRule}</p>

          {/* Nhóm nền: nói thẳng loại nào ra nền nào, vì đây là chỗ dễ nhận file
              sai nền nhất khi chọn nhiều loại cùng lúc. */}
          {groups.length > 1 ? (
            <ul className="m-0 flex flex-col gap-1 pl-0 text-[10.5px] text-n700">
              {groups.map((g) => {
                const label = BACKGROUNDS.find((b) => b.id === g.background);
                return (
                  <li key={g.background} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 flex-none rounded-full shadow-[inset_0_0_0_1px_var(--color-neutral-400)]"
                      style={{ background: g.hex }}
                    />
                    <span className="font-semibold">
                      {lang === "vi" ? label?.vi : label?.en}
                    </span>
                    <span className="text-n600">
                      {g.docIds
                        .map((id) => {
                          const d = getDoc(id);
                          return lang === "vi" ? d?.vi : d?.en;
                        })
                        .join(", ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
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
          <Toggle
            on={sharpen}
            onChange={onSharpen}
            label={t.sharpen}
            sub={t.sharpenSub}
          />
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {retouching ? (
          <Spinner
            label={
              groups.length > 1
                ? `${t.applying} (${doneCount + 1}/${groups.length})`
                : t.applying
            }
          />
        ) : failedBackgrounds.length ? (
          // Đã tốn một lần gọi model nhưng nền đo ra vẫn sai — KHÔNG được hiện dấu
          // tích xanh, vì người dùng sẽ chỉ biết khi bị trả ở quầy.
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 text-[12px] font-semibold leading-snug text-a700">
              <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-accent text-[11px] text-white">
                !
              </span>
              {t.bgNotApplied}
            </div>
            <GhostButton onClick={onRetryBg} dark={false}>
              {t.bgRetry}
            </GhostButton>
          </div>
        ) : pendingCount === 0 ? (
          <div className="flex items-center gap-2 text-[12px] font-semibold text-g700">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-g500 text-[11px] text-white">
              ✓
            </span>
            {groups.length > 1
              ? `${t.bgDone} · ${groups.length} ${lang === "vi" ? "nền" : "backgrounds"}`
              : t.bgDone}
          </div>
        ) : (
          <GhostButton onClick={onRetouch} dark={false}>
            {pendingCount > 1 ? `${t.applyBg} (${pendingCount}×)` : t.applyBg}
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
