"use client";

import { useState } from "react";
import { downloadDataUrl, formatBytes } from "@/lib/capture";
import type { Copy, Lang } from "@/lib/i18n";
import type { ExportedFile } from "@/app/api/export/route";
import { ErrorNote, PrimaryButton } from "@/components/ui";

export function Done({
  t,
  lang,
  files,
  onAgain,
}: {
  t: Copy;
  lang: Lang;
  files: ExportedFile[];
  onAgain: () => void;
}) {
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
      for (const f of files) {
        zip.file(f.name, f.dataUrl.split(",")[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      downloadDataUrl(url, "anh-the.zip");
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  const warned = files.filter((f) => f.upscaled || f.warnings.length > 0);

  return (
    <div className="screen-in scr relative flex h-full flex-col gap-4 overflow-auto bg-g700 px-5 pb-7 pt-10 text-g100">
      <div className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-g600 opacity-80" />

      <div className="relative flex flex-col gap-2.5">
        <span className="grid h-[74px] w-[74px] place-items-center rounded-full bg-g100 text-[34px] text-g800">
          ✓
        </span>
        <h2 className="mt-1.5 text-[30px] leading-[1.08]">{t.doneTitle}</h2>
        <p className="m-0 max-w-[30ch] text-[13px] leading-normal text-g200">
          {t.doneSub}
        </p>
      </div>

      <div className="flex flex-col">
        {files.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-3 border-t border-g100/20 px-0.5 py-2.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.dataUrl}
              alt=""
              className="h-[38px] w-[28px] flex-none rounded object-cover"
            />
            <div className="flex flex-1 flex-col gap-px">
              <span className="text-[12.5px] font-semibold">{f.name}</span>
              <span className="text-[10.5px] text-g300">
                {f.meta} · {formatBytes(f.bytes)}
              </span>
              {f.upscaled ? (
                <span className="text-[10.5px] text-a300">
                  {lang === "vi"
                    ? "Đã phóng to từ ảnh gốc — in ra có thể hơi mềm nét"
                    : "Upscaled from the source — may look soft in print"}
                </span>
              ) : null}
            </div>
            <button
              onClick={() => downloadDataUrl(f.dataUrl, f.name)}
              className="rounded-full px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-g200 shadow-[inset_0_0_0_1.5px_rgba(240,250,225,.45)]"
            >
              {t.downloadOne}
            </button>
          </div>
        ))}
      </div>

      {warned.some((f) => f.warnings.length) ? (
        <ul className="m-0 list-disc space-y-1 pl-4 text-[11px] leading-snug text-a200">
          {warned.flatMap((f) =>
            f.warnings.map((w) => <li key={`${f.name}-${w}`}>{`${f.label}: ${w}`}</li>)
          )}
        </ul>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="mt-auto flex flex-col gap-2.5 pt-2">
        <PrimaryButton onClick={downloadAll} tone="cream" disabled={zipping}>
          {zipping ? "…" : t.download}
        </PrimaryButton>
        <button
          onClick={onAgain}
          className="rounded-full py-2.5 text-[12.5px] font-semibold text-g200"
        >
          {t.again}
        </button>
      </div>
    </div>
  );
}
