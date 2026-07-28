"use client";

import {
  BACKGROUNDS,
  bgHex,
  getDoc,
  pxLabel,
  type BackgroundId,
  type DocSpec,
} from "@/lib/docs";
import type { Compliance } from "@/lib/checks";
import { CHECK_LABELS, type Copy, type Lang } from "@/lib/i18n";
import type { ExportBlock, Working } from "@/lib/studio";
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
  readyBackgrounds,
  pendingCount,
  block,
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
  /** Những nền ĐÃ có bản chuẩn hoá — quyết định nhóm nào tick là xuất được ngay */
  readyBackgrounds: BackgroundId[];
  /** Số nhóm nền còn phải thay — tick thêm loại có thể sinh nhóm nề��n mới */
  pendingCount: number;
  /** Vì sao chưa xuất được; `null` = xuất được */
  block: ExportBlock;
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

  /**
   * Danh sách nhóm theo NỀN, không phải một dãy phẳng.
   *
   * Một nền = một ảnh đã chuẩn hoá = một lần gọi model. Dãy phẳng giấu mất ranh
   * giới đó: ảnh vừa chuẩn hoá nền xanh mà Visa Mỹ (bắt buộc nền trắng) nằm ngay
   * cạnh như thể cùng một ảnh — người dùng có lý khi hỏi "sao nền xanh lại xuất
   * được visa Mỹ". Trả lời nằm ở cấu trúc: tick loại khác nền là bước sang nhóm
   * khác, và nhóm đó nói ngay trên đầu là đã có ảnh hay cần thêm một lượt.
   */
  const groups = BACKGROUNDS.map((b) => ({
    bg: b,
    ready: readyBackgrounds.includes(b.id),
    docs: docs.filter((d) => backgroundFor(d) === b.id),
  }))
    .filter((g) => g.docs.length > 0)
    // Nhóm của loại chính đứng đầu — đó là ảnh khách vừa nhìn thấy.
    .sort((a, b) =>
      a.docs.some((d) => d.id === primary)
        ? -1
        : b.docs.some((d) => d.id === primary)
          ? 1
          : 0
    );

  return (
    <div className="[&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[600px] lg:[&>*]:max-w-[1020px] screen-in scr flex h-full flex-col gap-4 overflow-auto bg-pop-bg px-5 pb-4 pt-5 font-body text-pop-ink">
      {/* Màn rộng: HAI CỘT — trái chọn loại, phải tờ in + nút xuất. Tiêu đề
          nằm TRONG cột trái để cột phải leo lên tận đỉnh — để ngoài thì tấm tờ
          in bị đẩy xuống dưới một khoảng trống vô nghĩa (phản hồi thật). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-8">
      <div className="flex flex-col gap-4">
      <BackBar onBack={onBack} title={t.exportTitle} dark={false} />
      <p className="-mt-2 text-[12.5px] leading-normal text-pop-ink/60">
        {t.exportSub}
      </p>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.bg.id} className="flex flex-col">
            {/* Đầu nhóm: nền nào, và tick vào đây thì được gì — ảnh có sẵn hay
                tốn thêm một lượt. Nói TRƯỚC khi tick, không phải sau. */}
            <div className="flex items-center gap-2 border-b-2 border-pop-ink/15 pb-1.5">
              <span
                className="h-3 w-3 flex-none rounded-[3px] border border-pop-ink/40"
                style={{ background: g.bg.hex }}
              />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-pop-ink/60">
                {lang === "vi" ? `Nền ${g.bg.vi.toLowerCase()}` : `${g.bg.en} background`}
              </span>
              <span
                className={`ml-auto text-[10px] font-semibold ${
                  g.ready ? "text-mint" : "text-pop-ink/45"
                }`}
              >
                {g.ready ? `✓ ${t.bgGroupReady}` : t.bgGroupExtra}
              </span>
            </div>
            {g.docs.map((d) => {
              const on = picked.includes(d.id);
              const isPrimary = d.id === primary;
              const w = workingFor(d.id);
              const fit = on ? fitOf(d.id) : null;
              return (
                <button
                  key={d.id}
                  onClick={() => onToggle(d.id)}
                  aria-pressed={on}
                  // Loại chính không bỏ tick được, nhưng KHÔNG được mờ đi — mờ đọc
                  // ra là "không dùng được", trong khi đây là tấm ảnh gốc của cả phiên.
                  disabled={isPrimary}
                  className="flex items-center gap-3 border-b border-pop-ink/10 px-0.5 py-2.5 text-left disabled:cursor-default disabled:opacity-100"
                >
                  {/* Chip VUÔNG — cùng lý do với khung preview: sản phẩm là ảnh
                      chữ nhật, bo tròn là vẽ sai nó. */}
                  <span className="w-[34px] flex-none overflow-hidden border border-pop-ink/25">
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
                        <span className="pl-1.5 text-[10px] font-semibold uppercase tracking-wider text-pink">
                          {t.primaryTag}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[10.5px] text-pop-ink/50">{pxLabel(d)}</span>
                    {!d.verified ? (
                      <span className="text-[10px] text-pink/80">{t.unverified}</span>
                    ) : null}
                    {/* Loại nào KHÔNG lấy được từ tấm ảnh này thì nói ngay ở dòng
                        của nó, đừng để người dùng xuất ra rồi mới đọc cảnh báo. */}
                    {fit?.errors.length ? (
                      <span className="text-[10px] leading-snug text-pink">
                        {fit.errors[0]}
                      </span>
                    ) : null}
                    {fit && !fit.resolutionOk ? (
                      <span className="text-[10px] leading-snug text-pink">
                        {t.lowRes}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="grid h-6 w-6 flex-none place-items-center rounded-[6px] border-2 border-pop-ink text-[13px] font-bold"
                    style={{
                      color: on ? "#fff" : "transparent",
                      background: on ? "var(--color-mint)" : "#fff",
                    }}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {failing.length ? (
        <ErrorNote>
          <strong className="block pb-1">{t.stillFailing}</strong>
          {failing.map((c) => CHECK_LABELS[c.id]?.[lang] ?? c.id).join(", ")}
        </ErrorNote>
      ) : null}

      {/* Loại mới tick có thể đòi màu nền khác — cần thêm một lần thay nền nữa. */}
      {pendingCount > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-pop-ink bg-sun-1 px-3.5 py-3">
          <span className="text-[11.5px] font-semibold leading-snug">
            {t.needMoreBg}
          </span>
          {retouching ? (
            <Spinner label={t.applying} />
          ) : (
            <GhostButton onClick={onRetouch} dark={false}>
              {pendingCount > 1 ? `${t.applyBg} (${pendingCount}×)` : t.applyBg}
            </GhostButton>
          )}
        </div>
      ) : null}
      </div>

      <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-pop-ink bg-white p-4 shadow-[4px_4px_0_var(--color-pop-ink)]">
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
                    className={`rounded-[6px] border-2 px-2.5 py-1 text-[10.5px] font-bold ${
                      on
                        ? "border-pop-ink bg-pop-ink text-white"
                        : "border-pop-ink/20 text-pop-ink/60"
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
          <>
            {/* Disable CÂM là tệ nhất: khách bấm không được mà không biết vì sao.
                Nói lý do ngay trên nút. */}
            {block ? (
              <p className="m-0 pb-2 text-center text-[11.5px] font-semibold leading-snug text-pink">
                {block === "failed-background" ? t.blockBgFailed : t.blockBgPending}
              </p>
            ) : null}
            <PrimaryButton
              onClick={onExport}
              disabled={picked.length === 0 || block !== null}
            >
              {lang === "vi" ? `Xuất ${count} tệp` : `Export ${count} files`}
            </PrimaryButton>
          </>
        )}
      </div>
      </div>
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
      className="relative w-full overflow-hidden rounded-[2px] border border-pop-ink/20 bg-white"
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
  const horizontal = "absolute z-20 h-px w-[6px] bg-pop-ink/50";
  const vertical = "absolute z-20 h-[6px] w-px bg-pop-ink/50";

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
