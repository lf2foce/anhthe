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
    <div className="screen-in isolate flex h-full min-h-0 flex-col overflow-hidden bg-n900 lg:flex-row">
      {/* Khung ảnh CANH GIỮA có đệm quanh, không dán sát mép. Ảnh dán sát mép
          thì phần nới khung (nền thêm vào quanh đầu) trông như lỗi render; có
          đệm và viền thì nó đọc ra là một tấm ảnh thành phẩm đặt trên bàn. */}
      <div
        className="relative z-10 grid h-[300px] flex-none place-items-center overflow-hidden bg-n800 p-4 lg:h-full lg:min-w-0 lg:flex-1 lg:p-8"
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
          className="relative overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,.45)] ring-1 ring-n700"
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
        {/* Nút này nằm ĐÈ lên ảnh, nên nền mờ 55% biến nó thành vô hình trên ảnh
            sáng. Dùng nền đặc + viền sáng + đổ bóng để nổi trên mọi ảnh. */}
        <button
          onClick={onBack}
          aria-label={t.back}
          className="absolute left-3.5 top-3.5 grid h-10 w-10 place-items-center rounded-full bg-n900/85 text-[17px] font-bold text-n100 shadow-[0_2px_10px_rgba(0,0,0,.45)] ring-[1.5px] ring-n100/45 backdrop-blur-sm"
        >
          ←
        </button>

        {/* Ẩn/hiện kẻ chuẩn — cùng ngôn ngữ hình với nút xem ảnh gốc bên dưới */}
        <button
          onClick={() => setShowGuides((v) => !v)}
          aria-pressed={showGuides}
          className="absolute right-3.5 top-3.5 rounded-full bg-n900/85 px-3.5 py-1.5 text-[11.5px] font-bold text-n100 shadow-[0_2px_10px_rgba(0,0,0,.45)] ring-1 ring-n100/30 backdrop-blur-sm"
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
            className="absolute bottom-3.5 left-1/2 -translate-x-1/2 rounded-full bg-n900/85 px-3.5 py-1.5 text-[11.5px] font-bold text-n100 shadow-[0_2px_10px_rgba(0,0,0,.45)] ring-1 ring-n100/30 backdrop-blur-sm"
          >
            {peek ? t.peekOn : t.peekHint}
          </button>
        ) : null}
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

        {/* BẬC 1 — việc BẮT BUỘC: đưa ảnh về đúng chuẩn loại giấy tờ (nền +
            khung). Tách bậc rõ vì trộn với đồ làm đẹp thì trạng thái chuẩn hoá
            — thứ quyết định file có nộp được không — nằm lọt giữa các toggle
            tuỳ hứng, trông cùng hạng với "làm mịn da". */}
        <div className="flex items-center gap-2">
          <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-n900 text-[10px] font-bold text-n100">
            1
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
            {t.sectionFormat}
          </span>
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

        {/* Tỉ lệ đầu ở BẬC 1: nó là ràng buộc của chuẩn (có dải cho phép),
            không phải làm đẹp. */}
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
          // Xong rồi thì trạng thái phải NÓI RÕ và phải có đường làm lại. Bản cũ
          // chỉ có một dấu tích nhỏ lọt giữa danh sách: khách không ưng kết quả
          // là hết đường, phải chụp lại từ đầu.
          <div
            className={`flex flex-col gap-2 rounded-2xl px-3.5 py-2.5 ${
              needsRefill ? "bg-a100" : "bg-g100"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`flex items-center gap-2 text-[12px] font-bold ${
                  needsRefill ? "text-a700" : "text-g800"
                }`}
              >
                <span
                  className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] text-white ${
                    needsRefill ? "bg-accent" : "bg-g500"
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
                className={`flex-none rounded-full px-3 py-1.5 text-[11.5px] font-bold ${
                  needsRefill
                    ? "bg-accent text-white"
                    : "text-g800 shadow-[inset_0_0_0_1.5px_var(--color-accent-2-500)]"
                }`}
              >
                {t.redo}
              </button>
            </div>
            {/* Nối thanh trượt cỡ đầu với nút chạy lại: kéo cỡ xong mà không chạy
                lại thì phần thân thiếu bị lấp phẳng, và chỗ đó chỉ lộ ra ở file
                cuối. */}
            {needsRefill ? (
              <p className="m-0 text-[10.5px] leading-snug text-a700">
                {t.needsRefill}
              </p>
            ) : null}
          </div>
        ) : working.backgroundOk !== undefined ? (
          // Version hiện tại chưa sinh nhưng đang HIỂN THỊ version anh em (cùng
          // nền, khác tuỳ chọn) — công chuẩn hoá vẫn còn đó. Hiện khối nhỏ "áp
          // tuỳ chọn mới", KHÔNG quăng lại khối giới thiệu to như chưa làm gì:
          // preview tụt về ảnh gốc + khối to đọc ra là "mất trắng" (phản hồi thật).
          <div className="flex flex-col gap-2 rounded-2xl bg-a100 px-3.5 py-2.5">
            <span className="text-[11.5px] font-semibold leading-snug text-a700">
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
          <div className="flex flex-col gap-2 rounded-2xl bg-n900 p-3.5 text-n100">
            <span className="text-[13px] font-bold">{t.improveTitle}</span>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[11.5px] leading-snug text-n400">
              {t.improveSteps.map((x) => (
                <li key={x} className="flex gap-1.5">
                  <span className="text-g400">→</span>
                  {x}
                </li>
              ))}
            </ul>
            <PrimaryButton onClick={onRetouch}>
              {pendingCount > 1 ? `${t.improveCta} (${pendingCount}×)` : t.improveCta}
            </PrimaryButton>
          </div>
        )}

        {/* BẬC 2 — làm đẹp TUỲ CHỌN. Mịn da đổi công thức AI nên bật/tắt có thể
            đưa bậc 1 về "cần chạy version này"; nét và sáng là lớp tất định,
            đổi thoải mái không tốn gì. */}
        <div className="flex items-center gap-2 pt-1">
          <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-n900 text-[10px] font-bold text-n100">
            2
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
            {t.sectionExtra}
          </span>
        </div>

        <div className="flex flex-col gap-3">
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
        </div>

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
