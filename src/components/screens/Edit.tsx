"use client";

import { useState } from "react";

import {
  BACKGROUNDS,
  bgHex,
  getDoc,
  type BackgroundGroup,
  type BackgroundId,
  type DocSpec,
} from "@/lib/docs";
import { computeCrop, extendToFit, needsBodyFill } from "@/lib/geometry";
import type { Copy, Lang } from "@/lib/i18n";
import type { Working } from "@/lib/studio";
import { CropPreview } from "@/components/CropPreview";
import { ErrorNote, GhostButton, PrimaryButton, Spinner, Toggle } from "@/components/ui";

export function Edit({
  t,
  lang,
  working,
  before,
  spec,
  bg,
  allowed,
  groups,
  pendingCount,
  failedBackgrounds,
  brightness,
  headScale,
  sharpen,
  retouching,
  error,
  onBg,
  onBrightness,
  onHeadScale,
  onSharpen,
  onRetouch,
  onRetryBg,
  onRedo,
  onBack,
  onNext,
}: {
  t: Copy;
  lang: Lang;
  working: Working;
  /** Ảnh TRƯỚC khi chuẩn hoá — để so sánh; `null` khi chưa chuẩn hoá */
  before: Working | null;
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
  sharpen: boolean;
  retouching: boolean;
  error: string | null;
  onBg: (id: BackgroundId) => void;
  onBrightness: (v: number) => void;
  onHeadScale: (v: number) => void;
  onSharpen: (v: boolean) => void;
  onRetouch: () => void;
  onRetryBg: () => void;
  /** Chạy lại chuẩn hoá dù lần trước đã thành công — tốn một lượt */
  onRedo: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  // Cùng phép nới ảo với preview/evaluate/export — bốn nơi phải kể một câu chuyện.
  const plan = extendToFit(working.landmarks, working.width, working.height, [spec], {
    [spec.id]: headScale,
  });
  const fit = computeCrop(plan.landmarks, plan.width, plan.height, spec, headScale);
  const doneCount = groups.length - pendingCount;
  /**
   * Giữ để xem ảnh gốc.
   *
   * Toàn bộ giá trị sản phẩm nằm ở phép biến đổi này, mà sau khi chạy xong thì
   * khách không còn thấy nó nữa — vừa mất chỗ khoe, vừa mất đường tự kiểm.
   */
  const [peek, setPeek] = useState(false);
  const shown = peek && before ? before : working;
  /**
   * Ẩn/hiện kẻ chuẩn. Dải kẻ trả lời "đạt chưa" nhưng cũng che đúng vùng mắt và
   * trán — chỗ người ta nhìn kỹ nhất khi duyệt ảnh của chính mình. Cho tắt tạm
   * để ngắm ảnh trần; mặc định vẫn bật vì kẻ là công cụ canh, không phải trang trí.
   */
  const [showGuides, setShowGuides] = useState(true);

  /**
   * Cỡ đầu đang chọn có cần khung rộng hơn ảnh đang có không.
   *
   * Cỡ đầu và bề rộng khung tỉ lệ nghịch, nên kéo thanh trượt sau khi đã chuẩn hoá
   * có thể đòi phần thân mà ảnh không có. Bước xuất sẽ lấp phẳng bằng màu nền —
   * vai cụt ngang giữa nền. Cùng MỘT luật với server (needsBodyFill): thiếu đáy
   * là giục ngay dù chỉ vài phần trăm, vì đáy là thân người chứ không phải nền.
   */
  const needsRefill = before !== null && needsBodyFill(plan);

  return (
    // Sân khấu SÁNG tím nhạt: mảng mực đặc chiếm nửa màn nhìn nặng (phản hồi
    // thật), và ảnh đã tự tách khỏi nền bằng khung trắng + bóng — không cần cả
    // căn phòng tối để làm việc đó. Tím nhạt (chứ không trùng màu panel) để hai
    // vùng vẫn đọc ra là hai vai: bên soi ảnh, bên chỉnh.
    <div className="screen-in isolate flex h-full min-h-0 flex-col overflow-hidden bg-viol-1 lg:flex-row">
      {/* Khung ảnh CANH GIỮA có đệm quanh, không dán sát mép. Ảnh dán sát mép
          thì phần nới khung (nền thêm vào quanh đầu) trông như lỗi render; có
          đệm và viền thì nó đọc ra là một tấm ảnh thành phẩm đặt trên bàn. */}
      <div
        className="relative z-10 grid h-[300px] flex-none place-items-center overflow-hidden bg-viol-1 p-4 lg:h-full lg:min-w-0 lg:flex-1 lg:p-8"
        style={{ containerType: "size" }}
      >
        {/*
          Khung phải VỪA KHÍT ô chứa theo cả hai chiều — như `object-fit: contain`.
          `aspect-ratio` KHÔNG tự tạo kích thước, nó chỉ suy chiều còn lại từ một
          chiều đã biết; chỉ đặt `max-h/max-w` là không còn chiều nào và div co về
          0×0 (ảnh biến mất hoàn toàn — đã xảy ra một lần).
          Chốt chiều CAO bằng min(cao ô chứa, cao suy từ bề ngang ô chứa) thì luôn
          có kích thước thật và không bao giờ tràn.
        */}
        <div
          // Góc VUÔNG: ảnh thẻ là hình chữ nhật, bo tròn preview là vẽ sai sản phẩm.
          className="relative overflow-hidden shadow-[0_10px_28px_rgba(36,27,64,.25)] ring-2 ring-pop-ink"
          style={{
            aspectRatio: `${spec.widthMm} / ${spec.heightMm}`,
            height: `min(100cqh, calc(100cqw * ${spec.heightMm} / ${spec.widthMm}))`,
          }}
        >
          <CropPreview
            photo={shown.photo}
            landmarks={shown.landmarks}
            imgW={shown.width}
            imgH={shown.height}
            spec={spec}
            backgroundHex={bgHex(bg)}
            headScale={headScale}
            brightness={brightness}
            // Preview phải ĐỔI khi bật nét — nút bật mà ảnh y nguyên thì người
            // dùng kết luận nút hỏng, dù file xuất có nét thật.
            sharpen={sharpen}
            guides={showGuides}
            labels={{ crown: t.crownLine, eye: t.eyeLine }}
            className="h-full w-full"
          />
        </div>
        {/* Nút đè lên ảnh: chip trắng viền mực — nổi trên cả ảnh sáng lẫn tối. */}
        <button
          onClick={onBack}
          aria-label={t.back}
          className="absolute left-3.5 top-3.5 grid h-10 w-10 place-items-center rounded-full border-2 border-pop-ink bg-white text-[17px] font-bold text-pop-ink shadow-[2px_2px_0_var(--color-pop-ink)]"
        >
          ←
        </button>

        {/* Ẩn/hiện kẻ chuẩn — cùng ngôn ngữ hình với nút xem ảnh gốc bên dưới */}
        <button
          onClick={() => setShowGuides((v) => !v)}
          aria-pressed={showGuides}
          className="absolute right-3.5 top-3.5 rounded-full border-2 border-pop-ink bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-pop-ink shadow-[2px_2px_0_var(--color-pop-ink)]"
        >
          {showGuides ? t.guidesHide : t.guidesShow}
        </button>

        {/* Giữ để xem ảnh gốc. Chạm/giữ chứ không phải bấm-đổi: so sánh kiểu
            nhấp-qua-nhấp-lại khó thấy khác biệt hơn nhiều so với giữ rồi thả. */}
        {before ? (
          <button
            onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)}
            onPointerLeave={() => setPeek(false)}
            className="absolute bottom-3.5 left-1/2 -translate-x-1/2 rounded-full border-2 border-pop-ink bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-pop-ink shadow-[2px_2px_0_var(--color-pop-ink)]"
          >
            {peek ? t.peekOn : t.peekHint}
          </button>
        ) : null}
      </div>

      {/* Panel = CHỒNG THẺ TRẮNG RỜI trên cùng mặt bàn tím nhạt với ảnh — không
          còn là tấm sheet dài dính vào mép phải. Mỗi bậc một thẻ, trạng thái
          chuẩn hoá sống TRONG thẻ bậc 1 (nó là kết quả của bậc đó), nút sang
          bước sau đứng riêng dưới cùng. */}
      <div className="scr relative z-0 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 font-body text-pop-ink lg:w-[420px] lg:flex-none lg:px-5 lg:pt-6">
        {/* Đang canh cho loại nào — nổi trên mặt bàn, không cần thẻ */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[17px] font-bold">
            {lang === "vi" ? spec.vi : spec.en}
          </span>
          <span className="flex-none rounded-full border-2 border-pop-ink bg-white px-2.5 py-0.5 text-[10.5px] font-bold">
            {spec.dim}
          </span>
        </div>

        {/* ── THẺ 1: đúng chuẩn giấy tờ (bắt buộc) ─────────────────────── */}
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-pop-ink bg-white p-4 shadow-[4px_4px_0_var(--color-pop-ink)]">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 flex-none place-items-center rounded-full border-2 border-pop-ink bg-pink text-[10px] font-bold text-white">
              1
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
              {t.sectionFormat}
            </span>
          </div>

          <div className="flex flex-col gap-2">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-pop-ink/45">
            {t.bgLabel}
          </span>
          <div className="flex gap-2">
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
                  className={`relative flex flex-1 items-center gap-2 rounded-full border-2 px-2.5 py-2 disabled:opacity-35 ${
                    on ? "border-viol bg-viol-1" : "border-pop-ink/15 bg-pop-bg"
                  }`}
                >
                  <span
                    className="h-[18px] w-[18px] flex-none rounded-full border border-pop-ink/30"
                    style={{ background: b.hex }}
                  />
                  <span className="text-[11px] font-bold">
                    {lang === "vi" ? b.vi : b.en}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="m-0 text-[10.5px] leading-snug text-pop-ink/50">{t.bgRule}</p>

          {/* Nhóm nền: nói thẳng loại nào ra nền nào, vì đây là chỗ dễ nhận file
              sai nền nhất khi chọn nhiều loại cùng lúc. */}
          {groups.length > 1 ? (
            <ul className="m-0 flex flex-col gap-1 pl-0 text-[10.5px] text-pop-ink/60">
              {groups.map((g) => {
                const label = BACKGROUNDS.find((b) => b.id === g.background);
                return (
                  <li key={g.background} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 flex-none rounded-full border border-pop-ink/30"
                      style={{ background: g.hex }}
                    />
                    <span className="font-semibold">
                      {lang === "vi" ? label?.vi : label?.en}
                    </span>
                    <span className="text-pop-ink/50">
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

        {/* Tỉ lệ đầu ở BẬC 1: nó là ràng buộc của chuẩn (có dải cho phép),
            không phải làm đẹp. */}
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[12px] font-semibold">
            <span>{t.headRatio}</span>
            <span className="font-bold text-viol">
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
          <span className="text-[10.5px] text-pop-ink/50">
            {lang === "vi" ? "Giới hạn chuẩn " : "Allowed "}
            {(spec.headRatio.min * 100).toFixed(0)}–
            {(spec.headRatio.max * 100).toFixed(0)}%
          </span>
        </label>

        <div className="flex flex-col border-t-2 border-pop-ink/10 pt-3">
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
            <div className="flex items-start gap-2 text-[12px] font-semibold leading-snug text-pink">
              <span className="grid h-5 w-5 flex-none place-items-center rounded-full border-2 border-pop-ink bg-pink text-[11px] text-white">
                !
              </span>
              {t.bgNotApplied}
            </div>
            <GhostButton onClick={onRetryBg} dark={false}>
              {t.bgRetry}
            </GhostButton>
          </div>
        ) : pendingCount === 0 ? (
          // Xong rồi thì trạng thái phải NÓI RÕ và phải có đường làm lại. Bản cũ
          // chỉ có một dấu tích nhỏ lọt giữa danh sách: khách không ưng kết quả
          // là hết đường, phải chụp lại từ đầu.
          <div
            className={`flex flex-col gap-2 rounded-2xl px-3.5 py-2.5 ${
              needsRefill ? "bg-pink-1" : "bg-mint-1"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`flex items-center gap-2 text-[12px] font-bold ${
                  needsRefill ? "text-pink" : "text-pop-ink"
                }`}
              >
                <span
                  className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] text-white ${
                    needsRefill ? "bg-pink" : "bg-mint"
                  }`}
                >
                  {needsRefill ? "!" : "✓"}
                </span>
                {groups.length > 1
                  ? `${t.bgDone} · ${groups.length} ${lang === "vi" ? "nền" : "backgrounds"}`
                  : t.bgDone}
              </span>
              <button
                onClick={onRedo}
                className={`flex-none rounded-full border-2 border-pop-ink px-3 py-1.5 text-[11.5px] font-bold ${
                  needsRefill ? "bg-pink text-white" : "bg-white"
                }`}
              >
                {t.redo}
              </button>
            </div>
            {/* Nối thanh trượt cỡ đầu với nút chạy lại: kéo cỡ xong mà không chạy
                lại thì phần thân thiếu bị lấp phẳng, và chỗ đó chỉ lộ ra ở file
                cuối. */}
            {needsRefill ? (
              <p className="m-0 text-[10.5px] leading-snug text-pink">
                {t.needsRefill}
              </p>
            ) : null}
          </div>
        ) : working.backgroundOk !== undefined ? (
          // Version hiện tại chưa sinh nhưng đang HIỂN THỊ version anh em (cùng
          // nền, khác tuỳ chọn) — công chuẩn hoá vẫn còn đó. Hiện khối nhỏ "áp
          // tuỳ chọn mới", KHÔNG quăng lại khối giới thiệu to như chưa làm gì:
          // preview tụt về ảnh gốc + khối to đọc ra là "mất trắng" (phản hồi thật).
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-pop-ink bg-sun-1 px-3.5 py-2.5">
            <span className="text-[11.5px] font-semibold leading-snug">
              {t.variantStale}
            </span>
            <PrimaryButton onClick={onRetouch}>
              {pendingCount > 1
                ? `${t.variantApply} (${pendingCount}×)`
                : t.variantApply}
            </PrimaryButton>
          </div>
        ) : (
          // Đây là bước BẮT BUỘC của luồng, không phải tuỳ chọn phụ. Bản cũ để
          // nó là nút phụ mờ tên "Thay nền bằng AI" — vừa nói về CƠ CHẾ thay vì
          // kết quả, vừa trông như thứ bỏ qua được, trong khi bỏ qua là nhận
          // file nền phòng khách.
          <div className="flex flex-col gap-2.5">
            <span className="font-display text-[15px] font-bold">
              {t.improveTitle}
            </span>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[11.5px] leading-snug text-pop-ink/65">
              {t.improveSteps.map((x) => (
                <li key={x} className="flex gap-1.5">
                  <span className="font-bold text-mint">→</span>
                  {x}
                </li>
              ))}
            </ul>
            <PrimaryButton onClick={onRetouch}>
              {pendingCount > 1 ? `${t.improveCta} (${pendingCount}×)` : t.improveCta}
            </PrimaryButton>
          </div>
        )}
        </div>
        </section>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {/* ── THẺ 2: làm đẹp tuỳ chọn — tất định, đổi thoải mái không tốn lượt */}
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-pop-ink bg-white p-4 shadow-[4px_4px_0_var(--color-pop-ink)]">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 flex-none place-items-center rounded-full border-2 border-pop-ink bg-sky text-[10px] font-bold text-white">
              2
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
              {t.sectionExtra}
            </span>
          </div>
          {/* KHÔNG có toggle mịn da ở luồng ảnh thẻ: mịn NHẸ là một phần của mẫu
              chuẩn hoá chung (như tiệm ảnh — không ai hỏi khách chọn mức da).
              Bậc 2 vì thế chỉ còn đồ TẤT ĐỊNH — đổi thoải mái, không tốn lượt,
              không đẻ version. Muốn làm đẹp tuỳ ý là việc của Studio sáng tạo. */}
          <Toggle
            on={sharpen}
            onChange={onSharpen}
            label={t.sharpen}
            sub={t.sharpenSub}
          />
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-[12px] font-semibold">
              <span>{t.bright}</span>
              <span className="font-bold text-viol">
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
        </section>

        <p className="m-0 px-1 text-[11px] leading-snug text-pop-ink/50">{t.editNote}</p>

        {fit.errors.length ? (
          <ul className="m-0 list-disc space-y-1 pl-4 text-[11px] leading-snug text-pink">
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
