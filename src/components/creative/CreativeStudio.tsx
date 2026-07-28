"use client";

/**
 * Studio sáng tạo — luồng thứ hai, TÁCH HẲN luồng ảnh thẻ.
 *
 * Nguyên tắc UX: TẠO TRƯỚC, CHỈNH SAU. Bấm phong cách là tạo ngay với mặc định
 * hợp lý — không có form chắn giữa người dùng và phần thưởng. Mọi tuỳ chỉnh
 * (dặn AI, khung, 2K, số ảnh) nằm ở màn kết quả, nơi người dùng ĐANG nhìn ảnh
 * và biết mình muốn đổi gì. Vòng lặp: xem → dặn → vẽ lại / tạo thêm → tới khi ưng.
 *
 * Không compliance, không landmark, không crop — model vẽ lại toàn bộ; sàn duy
 * nhất là danh tính (lib/packs.ts, có test). Ảnh gốc giữ lại giữa các phong cách.
 */

import { useRef, useState } from "react";
import { generateImages, refineImage, unlockImage } from "@/lib/api";
import { downloadUrl, fetchBlob } from "@/lib/capture";
import type { StoredImage } from "@/lib/storage";
import {
  ASPECT_CHOICES,
  ratioLabel,
  MAX_NOTE_LENGTH,
  PACKS,
  getPack,
  type AspectChoice,
  type StylePack,
} from "@/lib/packs";
import type { Copy, Lang } from "@/lib/i18n";
import { Capture } from "@/components/screens/Capture";
import { UnlockPanel } from "@/components/UnlockPanel";
import {
  BackBar,
  ErrorNote,
  PrimaryButton,
  Spinner,
  Toggle,
} from "@/components/ui";

type Step = "packs" | "capture" | "results";

/** Một ảnh kết quả + trạng thái vòng chỉnh của riêng nó */
interface Shot {
  /** Ảnh trên object storage: url xem được, key để mở khoá sau khi trả tiền */
  img: StoredImage;
  busy: boolean;
}

export function CreativeStudio({
  t,
  lang,
  onExit,
}: {
  t: Copy;
  lang: Lang;
  onExit: () => void;
}) {
  const [step, setStep] = useState<Step>("packs");
  const [packId, setPackId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  // Tuỳ chỉnh — sống ở màn kết quả, áp cho lượt tạo/vẽ lại KẾ TIẾP
  const [note, setNote] = useState("");
  const [aspect, setAspect] = useState<AspectChoice>("4:5");
  const [quality, setQuality] = useState<"std" | "high">("std");
  const [count, setCount] = useState<2 | 4>(2);
  const [showOpts, setShowOpts] = useState(false);

  const [shots, setShots] = useState<Shot[]>([]);
  /** Ảnh cùng một phiên nằm chung thư mục trên storage — dọn theo TTL cho gọn */
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  /** Kích thước thật của ảnh đang xem — đọc từ onLoad, cho chip tỉ lệ */
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pack = getPack(packId ?? "") ?? null;
  const selected = shots[sel] ?? null;
  const lockedCount = shots.filter((s) => !s.img.unlocked).length;

  /**
   * Đổi mọi ảnh đang khoá sang link bản sạch. Gọi sau khi đơn chuyển "đã trả".
   * Ảnh nào xin không được thì GIỮ NGUYÊN bản xem thử — thà thấy chữ chìm còn
   * hơn thấy ảnh vỡ.
   */
  async function unlockAll() {
    if (!sessionId) return;
    const next = await Promise.all(
      shots.map(async (shot) => {
        if (shot.img.unlocked) return shot;
        try {
          const { url } = await unlockImage({ key: shot.img.key, sessionId });
          return { ...shot, img: { ...shot.img, url, unlocked: true } };
        } catch {
          return shot;
        }
      })
    );
    setShots(next);
  }

  /**
   * Đời của LÔ ảnh (tăng khi thay lô) và của LƯỢT tạo. Người dùng được tự do bấm
   * "Đổi phong cách" giữa chừng rồi tạo lô khác — không có guard này thì hai lượt
   * đua nhau: lượt cũ về sau đè ảnh pack cũ vào lô pack mới, còn kết quả vẽ-lại
   * về muộn thì thay nhầm ảnh cùng chỉ số trong lô đã khác.
   */
  const batchRef = useRef(0);
  const genRef = useRef(0);

  async function generate(src: string, target: StylePack, append: boolean) {
    const myBatch = append ? batchRef.current : ++batchRef.current;
    const myGen = ++genRef.current;
    setStep("results");
    setGenerating(true);
    setError(null);
    if (!append) setShots([]);
    try {
      const out = await generateImages({
        photo: src,
        packId: target.id,
        sessionId,
        count,
        note,
        aspectRatio: aspect,
        quality,
      });
      // Lô đã bị thay khi lượt này đang bay → kết quả thuộc về quá khứ, bỏ.
      if (batchRef.current !== myBatch) return;
      setSessionId(out.sessionId);
      const fresh = out.images.map((img) => ({ img, busy: false }));
      setShots((prev) => {
        const next = append ? [...prev, ...fresh] : fresh;
        // Nhảy tới ảnh mới đầu tiên — người dùng vừa bấm tạo thì muốn xem cái mới.
        setSel(append ? prev.length : 0);
        return next;
      });
    } catch (e) {
      if (genRef.current === myGen) setError((e as Error).message);
    } finally {
      // Chỉ lượt MỚI NHẤT được tắt spinner — lượt cũ về sau không được tắt đèn
      // của lượt đang chạy.
      if (genRef.current === myGen) setGenerating(false);
    }
  }

  /** Vòng lặp trên MỘT ảnh: ghi chú → vẽ lại, hoặc nâng 2K. Kết quả THAY ảnh cũ. */
  async function refine(index: number, opts: { note: string; upscale: boolean }) {
    const target = shots[index];
    if (!target || target.busy) return;
    const myBatch = batchRef.current;
    setError(null);
    setShots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, busy: true } : s))
    );
    try {
      const out = await refineImage({
        photo: target.img.url,
        sessionId,
        ...opts,
      });
      if (batchRef.current !== myBatch) return; // ảnh gốc không còn trong lô
      setSessionId(out.sessionId);
      setShots((prev) =>
        prev.map((s, i) => (i === index ? { img: out.image, busy: false } : s))
      );
    } catch (e) {
      if (batchRef.current !== myBatch) return;
      setError((e as Error).message);
      setShots((prev) =>
        prev.map((s, i) => (i === index ? { ...s, busy: false } : s))
      );
    }
  }

  /** Tạo ngay với mặc định của pack — không form nào chắn đường. */
  function pickPack(p: StylePack) {
    setPackId(p.id);
    setAspect(p.aspectRatio);
    if (photo) void generate(photo, p, false);
    else setStep("capture");
  }

  async function downloadAll() {
    setZipping(true);
    try {
      // jszip nạp động — chỉ cần khi bấm tải, không nên nằm trong bundle chung.
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      // Tải hết về TRƯỚC rồi mới gói: đưa Promise thẳng cho jszip thì lỗi mạng
      // giữa chừng cho ra file zip thiếu ảnh mà không ai biết.
      const blobs = await Promise.all(shots.map((s) => fetchBlob(s.img.url)));
      blobs.forEach((b, i) =>
        zip.file(`${pack?.id ?? "anh"}-${i + 1}.jpg`, b)
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, `studio-${pack?.id ?? "anh"}.zip`);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  // ── màn chụp ───────────────────────────────────────────────────────────────
  if (step === "capture") {
    return (
      <Capture
        t={t}
        onBack={() => setStep(shots.length > 0 ? "results" : "packs")}
        onPhoto={(src) => {
          setPhoto(src);
          if (pack) void generate(src, pack, false);
        }}
      />
    );
  }

  // ── màn kết quả: ảnh to + dải thumbnail + một ô dặn AI cho cả hai việc ────
  if (step === "results" && pack) {
    // Chọn = pill cam đặc chữ trắng — cùng ngôn ngữ với chấm bước ở rail; chưa
    // chọn = viền mảnh. Hai trạng thái phải khác nhau NGAY cả khi liếc.
    const chip = (on: boolean) =>
      `rounded-full border-2 px-3 py-1.5 text-[11px] font-bold ${
        on ? "border-pop-ink bg-viol text-white" : "border-pop-ink/15 bg-white text-pop-ink/60"
      }`;

    return (
      // lg phải NỚI trần bề rộng: lưới [1fr,380px] mà wrapper kẹp 600px thì cột
      // ảnh chỉ còn ~200px — ảnh thành mẩu giữa biển nền trống (đã dính).
      <div className="[&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[600px] lg:[&>*]:max-w-[1020px] screen-in scr flex h-full flex-col gap-3 overflow-auto bg-pop-bg px-5 pb-4 pt-5 font-body text-pop-ink">
        <BackBar
          onBack={() => setStep("packs")}
          title={lang === "vi" ? pack.vi : pack.en}
          dark={false}
        />

        {/* Màn rộng: ẢNH bên trái, chỗ dặn AI và tuỳ chọn bên phải. Xếp dọc trên
            màn rộng thì ảnh bị nhét vào một cột hẹp còn điều khiển kéo ngang cả
            nghìn pixel — vừa xấu vừa phải đảo mắt lên xuống mỗi lần chỉnh. */}
        <div className="flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-3">

        {/* Khung ÔM ẢNH thay vì hộp cố định: ảnh dọc ra thẻ dọc, ảnh vuông ra
            thẻ vuông — hộp ngang cố định + object-contain từng để ảnh dọc kẹp
            giữa hai dải mực trống (phản hồi thật). Mọi nút/nhãn neo theo mép
            ẢNH, không theo mép hộp. */}
        {selected ? (
          <div className="grid flex-none place-items-center">
            <div className="relative overflow-hidden rounded-3xl border-2 border-pop-ink bg-pop-ink shadow-[5px_5px_0_var(--color-pop-ink)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.img.url}
                alt=""
                onLoad={(e) => {
                  const el = e.target as HTMLImageElement;
                  setDims({ w: el.naturalWidth, h: el.naturalHeight });
                }}
                className="block h-auto max-h-[46vh] w-auto max-w-full lg:max-h-[calc(100dvh-380px)]"
              />
              {selected.busy ? (
                <div className="absolute inset-0 grid place-items-center bg-pop-ink/45">
                  <span className="rounded-full bg-white px-4 py-2 text-pop-ink">
                    <Spinner label={t.refining} />
                  </span>
                </div>
              ) : null}
              {!selected.img.unlocked ? (
                <span className="absolute left-2.5 top-2.5 rounded-full border-2 border-pop-ink bg-sun px-2.5 py-1 text-[10.5px] font-bold text-pop-ink">
                  Bản xem thử
                </span>
              ) : null}
              {/* Tỉ lệ + kích thước THẬT của file — khách mua ảnh có quyền biết
                  đang cầm bao nhiêu pixel, và "Nâng 2K" có tác dụng thì thấy số
                  nhảy ngay tại đây */}
              {dims && !selected.busy ? (
                <span className="absolute bottom-2.5 left-2.5 rounded-full border-2 border-pop-ink bg-white px-2.5 py-1 text-[10.5px] font-bold text-pop-ink">
                  {ratioLabel(dims.w, dims.h)} · {dims.w}×{dims.h}px
                </span>
              ) : null}
              {!selected.busy ? (
                <div className="absolute bottom-2.5 right-2.5 flex gap-1.5">
                  <button
                    onClick={() =>
                      downloadUrl(selected.img.url, `${pack.id}-${sel + 1}.jpg`)
                    }
                    className="rounded-full border-2 border-pop-ink bg-white px-3 py-1.5 text-[11px] font-bold text-pop-ink"
                  >
                    {t.downloadOne}
                  </button>
                  <button
                    onClick={() => void refine(sel, { note: "", upscale: true })}
                    className="rounded-full border-2 border-pop-ink bg-mint px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    {t.upscale2k}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : generating ? (
          <div
            className="relative grid h-[46vh] max-h-[520px] min-h-[300px] flex-none place-items-center overflow-hidden rounded-3xl border-2 border-pop-ink text-white shadow-[5px_5px_0_var(--color-pop-ink)]"
            // Nền là GRADIENT CỦA PACK — vừa đỡ trống vừa nói đang vẽ phong cách nào
            style={{ background: pack.gradient }}
          >
            <div className="flex flex-col items-center gap-2.5">
              <span className="rounded-full border-2 border-pop-ink bg-white px-4 py-2 text-pop-ink shadow-[3px_3px_0_var(--color-pop-ink)]">
                <Spinner label={t.generating} />
              </span>
              <span className="rounded-full bg-pop-ink/35 px-3 py-1 text-[11px] font-semibold text-white">
                {t.generatingHint}
              </span>
            </div>
          </div>
        ) : null}

        {/* Dải chip — CHỈ ảnh đã có thật. Đang tạo lô mới thì không có chip chờ
            xoay vòng: khung to đã nói "đang vẽ" rồi, chip chờ chỉ thêm rối. */}
        {shots.length > 0 ? (
          <div className="scr -mx-1 flex flex-none gap-2 overflow-x-auto px-1 py-1">
            {shots.map((shot, i) => (
              <button
                key={i}
                onClick={() => {
                  setSel(i);
                  setDims(null);
                }}
                className={`relative h-[58px] w-[46px] flex-none overflow-hidden rounded-xl transition-opacity ${
                  i === sel
                    ? // Ring tách khỏi ảnh một khe nền — ôm sát mép là thành viền
                      // dày dính vào ảnh, nhìn "cấn"
                      "ring-2 ring-viol ring-offset-2 ring-offset-pop-bg"
                    : "ring-1 ring-pop-ink/25 opacity-70"
                } ${shot.busy ? "opacity-35" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}

        </div>

        <div className="flex min-w-0 flex-col gap-3">
        {/* MỘT ô dặn AI cho cả hai việc — vẽ lại ảnh này, hoặc tạo lô mới.
            Cả cụm điều khiển chỉ hiện khi ĐÃ có ảnh: chưa có gì để chỉnh thì
            đừng bày đồ chỉnh ra. */}
        {shots.length > 0 ? (
        <>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
          placeholder={t.notePlaceholder}
          rows={2}
          className="flex-none resize-none rounded-2xl border-2 border-pop-ink/20 bg-white px-3.5 py-2.5 text-[12.5px] text-pop-ink outline-none placeholder:text-pop-ink/40 focus:border-viol"
        />
        <div className="flex flex-none gap-2">
          {/* Disabled vẫn giữ HÌNH pill, chỉ đổi sang xám — mất hẳn nền thì nút
              trông như chữ trơ, lệch hẳn với nút bên cạnh. */}
          <button
            onClick={() => void refine(sel, { note, upscale: false })}
            disabled={!note.trim() || !selected || selected.busy}
            className="flex-1 rounded-full border-2 border-pop-ink bg-viol py-2.5 text-[12px] font-bold text-white disabled:border-pop-ink/20 disabled:bg-pop-ink/10 disabled:text-pop-ink/45"
          >
            {t.refineGo}
          </button>
          <button
            onClick={() => photo && void generate(photo, pack, true)}
            disabled={generating || !photo}
            className="flex-1 rounded-full border-2 border-pop-ink bg-white py-2.5 text-[12px] font-bold text-pop-ink"
          >
            {generating ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-pop-ink/25 border-t-viol" />
                {t.generating}
              </span>
            ) : (
              `${t.moreShots} (+${count})`
            )}
          </button>
        </div>

        {/* Tuỳ chọn nâng cao — gập mặc định, áp cho lượt kế tiếp */}
        <button
          onClick={() => setShowOpts(!showOpts)}
          className="flex-none text-left text-[11px] font-bold text-pop-ink/55"
        >
          {showOpts ? "▾" : "▸"} {t.optionsLabel}
        </button>
        {showOpts ? (
          <div className="flex flex-none flex-col gap-2.5 rounded-2xl border-2 border-pop-ink/15 bg-white p-3">
            <div className="flex items-center gap-1.5">
              <span className="w-[72px] flex-none text-[11px] font-semibold text-pop-ink/55">
                {t.aspectLabel}
              </span>
              {ASPECT_CHOICES.map((a) => (
                <button key={a} onClick={() => setAspect(a)} className={chip(a === aspect)}>
                  {a}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-[72px] flex-none text-[11px] font-semibold text-pop-ink/55">
                {t.countLabel}
              </span>
              {([2, 4] as const).map((n) => (
                <button key={n} onClick={() => setCount(n)} className={chip(n === count)}>
                  {n}
                </button>
              ))}
            </div>
            <Toggle
              on={quality === "high"}
              onChange={(v) => setQuality(v ? "high" : "std")}
              label={t.qualityHigh}
              sub={t.qualityHighSub}
            />
          </div>
        ) : null}

        {sessionId && lockedCount > 0 && !generating ? (
          <UnlockPanel
            sessionId={sessionId}
            planId="creative"
            lockedCount={lockedCount}
            onUnlocked={unlockAll}
          />
        ) : null}

        {shots.length > 1 && !generating ? (
          <PrimaryButton onClick={downloadAll} disabled={zipping}>
            {zipping ? "…" : t.download}
          </PrimaryButton>
        ) : null}
        </>
        ) : null}

        {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>
        </div>

        <div className="mt-auto flex flex-none items-center justify-between gap-2 pt-2.5 text-[11.5px] font-semibold">
          <button className="font-bold text-viol" onClick={() => setStep("packs")}>
            {t.changeStyle}
          </button>
          {/* Không xoá gì ở đây — lỡ tay bấm rồi back ra thì ảnh đã tạo vẫn còn.
              Lô cũ chỉ bị thay khi ảnh mới THẬT SỰ được chụp và lô mới về. */}
          <button className="font-bold text-pop-ink/50" onClick={() => setStep("capture")}>
            {t.newPhoto}
          </button>
        </div>
      </div>
    );
  }

  // ── màn chọn phong cách (đã chốt, giữ nguyên) ─────────────────────────────
  return (
    <div className="[&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[600px] screen-in scr flex h-full flex-col gap-4 overflow-auto bg-pop-bg px-5 pb-4 pt-5 font-body text-pop-ink">
      <BackBar onBack={onExit} title={t.flowCreativeTitle} dark={false} />
      <p className="-mt-2 text-[12.5px] leading-normal text-pop-ink/60">
        {t.packsSub}
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {PACKS.map((p) => (
          <button
            key={p.id}
            onClick={() => pickPack(p)}
            className="relative flex flex-col justify-end gap-0.5 overflow-hidden rounded-2xl border-2 border-pop-ink p-3 text-left shadow-[3px_3px_0_var(--color-pop-ink)]"
            style={{ background: p.gradient, aspectRatio: "3 / 4" }}
          >
            {/* Ảnh mẫu: người HƯ CẤU do AI tạo (gen-thumbs.mjs). Thiếu file thì
                còn gradient phía dưới — không vỡ layout. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.thumb}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 to-transparent" />
            <span className="relative text-[13.5px] font-bold leading-tight text-white drop-shadow">
              {lang === "vi" ? p.vi : p.en}
            </span>
            <span className="relative text-[9.5px] leading-snug text-white/80">
              {lang === "vi" ? p.subVi : p.subEn}
            </span>
          </button>
        ))}
      </div>

      {photo ? (
        <p className="m-0 text-[11px] font-semibold leading-snug text-mint">{t.packsReuse}</p>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <p className="mt-auto pt-2 text-[10.5px] leading-snug text-pop-ink/50">
        {t.creativeNote}
      </p>
    </div>
  );
}
