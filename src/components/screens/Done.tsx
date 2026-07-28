"use client";

import { useState } from "react";
import { downloadUrl, fetchBlob, formatBytes } from "@/lib/capture";
import type { Copy, Lang } from "@/lib/i18n";
import type { ExportedFile } from "@/app/api/export/route";
import { unlockImage } from "@/lib/api";
import { UnlockPanel } from "@/components/UnlockPanel";
import { ErrorNote, PrimaryButton } from "@/components/ui";

export function Done({
  t,
  lang,
  files,
  sessionId,
  onFiles,
  onAgain,
}: {
  t: Copy;
  lang: Lang;
  files: ExportedFile[];
  sessionId: string | null;
  /** Cập nhật lại danh sách sau khi mở khoá */
  onFiles: (files: ExportedFile[]) => void;
  onAgain: () => void;
}) {
  const lockedCount = files.filter((f) => !f.img.unlocked).length;

  /**
   * Đường TẢI đi qua proxy cùng origin, đường XEM (<img>) thì không.
   *
   * `fetch` chéo origin sang bucket R2 riêng tư (không CORS) chết bằng câu
   * "Failed to fetch" — <img> thì hiển thị bình thường vì không cần CORS, nên
   * bug chỉ nổ đúng lúc bấm tải zip. Qua proxy cũng đặt được tên file (link
   * chéo origin bị browser lờ thuộc tính download). Chế độ chưa có R2 trả data
   * URL — cùng origin sẵn, giữ nguyên.
   */
  const downloadPath = (f: ExportedFile) =>
    f.img.url.startsWith("http")
      ? `/api/blob?u=${encodeURIComponent(f.img.url)}&name=${encodeURIComponent(f.name)}`
      : f.img.url;

  /** Ảnh nào xin link sạch không được thì giữ nguyên bản xem thử */
  async function unlockAll() {
    if (!sessionId) return;
    onFiles(
      await Promise.all(
        files.map(async (f) => {
          if (f.img.unlocked) return f;
          try {
            const { url } = await unlockImage({ key: f.img.key, sessionId });
            return { ...f, img: { ...f.img, url, unlocked: true } };
          } catch {
            return f;
          }
        })
      )
    );
  }
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadAll() {
    setZipping(true);
    setError(null);
    try {
      // jszip nạp động: gói này chỉ cần khi người dùng bấm tải, không nên nằm
      // trong bundle của cả 6 màn.
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      // Tải hết về TRƯỚC rồi mới gói: lỗi mạng giữa chừng mà đưa Promise thẳng
      // cho jszip thì ra file zip thiếu ảnh mà không ai biết.
      const blobs = await Promise.all(files.map((f) => fetchBlob(downloadPath(f))));
      blobs.forEach((b, i) => zip.file(files[i].name, b));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, "anh-the.zip");
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  const warned = files.filter((f) => f.upscaled || f.warnings.length > 0);

  return (
    // Màn ăn mừng: nền sáng + mint, cùng ngôn ngữ pop với cả app.
    <div className="[&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[600px] screen-in scr relative flex h-full flex-col gap-4 overflow-auto bg-pop-bg px-5 pb-4 pt-6 font-body text-pop-ink">
      <div className="relative flex flex-col gap-2.5">
        <span className="grid h-[74px] w-[74px] -rotate-3 place-items-center rounded-full border-2 border-pop-ink bg-mint text-[34px] text-white shadow-[4px_4px_0_var(--color-pop-ink)]">
          ✓
        </span>
        <h2 className="mt-1.5 font-display text-[30px] font-bold leading-[1.08]">{t.doneTitle}</h2>
        <p className="m-0 max-w-[34ch] text-[13px] leading-normal text-pop-ink/60">
          {t.doneSub}
        </p>
      </div>

      <div className="flex flex-col">
        {files.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-3 border-t border-pop-ink/10 px-0.5 py-2.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.img.url}
              alt=""
              className="h-[38px] w-[28px] flex-none border border-pop-ink/25 object-cover"
            />
            <div className="flex flex-1 flex-col gap-px">
              <span className="text-[12.5px] font-semibold">{f.name}</span>
              <span className="text-[10.5px] text-pop-ink/50">
                {f.meta} · {formatBytes(f.bytes)}
              </span>
              {f.upscaled ? (
                <span className="text-[10.5px] text-pink">
                  {lang === "vi"
                    ? "Đã phóng to từ ảnh gốc — in ra có thể hơi mềm nét"
                    : "Upscaled from the source — may look soft in print"}
                </span>
              ) : null}
            </div>
            <button
              onClick={() => downloadUrl(downloadPath(f), f.name)}
              className="rounded-full border-2 border-pop-ink bg-white px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider"
            >
              {t.downloadOne}
            </button>
          </div>
        ))}
      </div>

      {warned.some((f) => f.warnings.length) ? (
        <ul className="m-0 list-disc space-y-1 pl-4 text-[11px] leading-snug text-pink">
          {warned.flatMap((f) =>
            f.warnings.map((w) => <li key={`${f.name}-${w}`}>{`${f.label}: ${w}`}</li>)
          )}
        </ul>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {sessionId && lockedCount > 0 ? (
        <UnlockPanel
          sessionId={sessionId}
          planId="id-set"
          lockedCount={lockedCount}
          onUnlocked={unlockAll}
        />
      ) : null}

      <div className="mt-auto flex flex-col gap-2.5 pt-2">
        <PrimaryButton onClick={downloadAll} tone="cream" disabled={zipping}>
          {zipping ? "…" : t.download}
        </PrimaryButton>
        <button
          onClick={onAgain}
          className="rounded-full py-2.5 text-[12.5px] font-bold text-pop-ink/60"
        >
          {t.again}
        </button>
      </div>
    </div>
  );
}
