"use client";

import { useEffect, useState } from "react";
import { passCount, requiredCount, type Compliance } from "@/lib/checks";
import { CHECK_LABELS, type Copy, type Lang } from "@/lib/i18n";
import { getDoc } from "@/lib/docs";
import {
  BackBar,
  Dot,
  ErrorNote,
  GhostButton,
  PrimaryButton,
  ScoreRing,
} from "@/components/ui";

export function Check({
  t,
  lang,
  photo,
  checking,
  result,
  error,
  onBack,
  onRetake,
  onContinue,
}: {
  t: Copy;
  lang: Lang;
  photo: string | null;
  checking: boolean;
  result: Compliance | null;
  error: string | null;
  onBack: () => void;
  onRetake: () => void;
  onContinue: () => void;
}) {
  return (
    // Nền SÁNG như phần còn lại của app — màn này là BÁO CÁO chấm điểm, không
    // phải màn soi ảnh, nên không có lý do giữ nền tối.
    <div className="[&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[600px] screen-in scr flex h-full flex-col gap-4 overflow-auto bg-pop-bg px-5 pb-4 pt-5 font-body text-pop-ink">
      <BackBar onBack={onBack} title={t.checkTitle} dark={false} />

      {checking ? <Scanning t={t} photo={photo} /> : null}

      {!checking && error ? (
        <div className="flex flex-col gap-3">
          <ErrorNote>
            <strong className="block pb-1">{t.checkFailed}</strong>
            {error}
          </ErrorNote>
          <PrimaryButton onClick={onRetake}>{t.retake}</PrimaryButton>
        </div>
      ) : null}

      {!checking && result ? (
        <Result
          t={t}
          lang={lang}
          result={result}
          onRetake={onRetake}
          onContinue={onContinue}
        />
      ) : null}
    </div>
  );
}

function Scanning({ t, photo }: { t: Copy; photo: string | null }) {
  // Tiến trình thật không đo được (một lệnh gọi model), nên thanh này tiệm cận
  // 92% rồi dừng — không bao giờ hiện 100% khi chưa có kết quả.
  const [pct, setPct] = useState(4);
  useEffect(() => {
    const id = setInterval(() => setPct((p) => p + (92 - p) * 0.06), 90);
    return () => clearInterval(id);
  }, []);

  const step = t.steps[Math.min(t.steps.length - 1, Math.floor(pct / 24))];

  return (
    <div className="flex flex-col items-center gap-4 py-3.5">
      <div className="relative aspect-[0.78] w-[150px] overflow-hidden rounded-[20px] border-2 border-pop-ink bg-white shadow-[4px_4px_0_var(--color-pop-ink)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-x-0 h-[24%] animate-[sweep_1.6s_linear_infinite] bg-gradient-to-b from-transparent via-viol/45 to-transparent" />
      </div>
      <span className="text-[14px] font-bold">{t.scanning}</span>
      <div className="h-1.5 w-[70%] overflow-hidden rounded-full bg-pop-ink/10">
        <div
          className="h-full rounded-full bg-viol transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11.5px] tracking-wide text-pop-ink/55">{step}</span>
    </div>
  );
}

function Result({
  t,
  lang,
  result,
  onRetake,
  onContinue,
}: {
  t: Copy;
  lang: Lang;
  result: Compliance;
  onRetake: () => void;
  onContinue: () => void;
}) {
  // Điểm chỉ tính trên tiêu chí BẮT BUỘC với tập giấy tờ đang chọn — chọn riêng
  // ảnh chân dung thì "cười nhẹ" không được phép trừ điểm.
  const total = requiredCount(result.checks);
  const score = passCount(result.checks);
  const verdict =
    result.verdict === "pass"
      ? { title: t.verdictPass, sub: t.verdictSubPass.replace("{n}", String(total)) }
      : result.verdict === "fixable"
        ? { title: t.verdictFixable, sub: t.verdictSubFixable }
        : { title: t.verdictFail, sub: t.verdictSubFail };

  return (
    <>
      <div className="flex items-center gap-4">
        <ScoreRing value={score} total={total} />
        <div className="flex flex-col gap-1.5">
          <span
            className={`text-[14px] font-bold leading-tight ${
              result.verdict === "fail" ? "text-pink" : "text-mint"
            }`}
          >
            {verdict.title}
          </span>
          <span className="text-[11.5px] leading-snug text-pop-ink/60">
            {verdict.sub}
          </span>
        </div>
      </div>

      <div className="flex flex-col">
        {result.checks.map((c) => (
          <div
            key={c.id}
            className={`flex items-start gap-3 border-t border-pop-ink/10 px-0.5 py-2.5 ${
              c.required ? "" : "opacity-55"
            }`}
          >
            <span className="pt-0.5">
              {/* Tiêu chí không bắt buộc trượt thì vẫn hiện, nhưng là ghi chú —
                  không tô đỏ, vì nó không chặn đường xuất file. */}
              <Dot ok={c.pass || !c.required} size={20} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12.5px] font-semibold leading-tight">
                {CHECK_LABELS[c.id]?.[lang] ?? c.id}
                {!c.required ? (
                  <span className="pl-1.5 font-normal text-pop-ink/45">
                    {t.notRequired}
                  </span>
                ) : c.requiredBy.length < result.fits.length ? (
                  // Chỉ MỘT SỐ loại đang chọn đòi tiêu chí này → nói tên ra.
                  // "Có gì đó hỏng" không giúp khách quyết định gì; "đeo kính
                  // hỏng Visa Mỹ" thì họ biết ngay là bỏ kính hay bỏ visa.
                  <span className="pl-1.5 font-normal text-pop-ink/45">
                    · {t.requiredForPrefix}{" "}
                    {c.requiredBy
                      .map((id) => {
                        const d = getDoc(id);
                        return lang === "vi" ? d?.vi : d?.en;
                      })
                      .join(", ")}
                  </span>
                ) : null}
              </span>
              {!c.pass && c.detail ? (
                <span
                  className={`text-[11px] leading-snug ${
                    c.required ? "text-pink" : "text-pop-ink/45"
                  }`}
                >
                  {c.detail}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-pop-ink/10 pt-3 text-[11px] text-pop-ink/50">
        {result.fits.map((f) => {
          const doc = getDoc(f.docId);
          if (!doc) return null;
          return (
            <div key={f.docId} className="flex justify-between gap-3">
              <span>{lang === "vi" ? doc.vi : doc.en}</span>
              <span className={f.errors.length ? "font-bold text-pink" : "font-bold text-mint"}>
                {lang === "vi" ? "đầu" : "head"}{" "}
                {(f.headRatio * 100).toFixed(0)}%
                {f.resolutionOk ? "" : lang === "vi" ? " · thiếu px" : " · low-res"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-2.5 pt-2.5">
        <div className="flex-none">
          <GhostButton onClick={onRetake} dark={false}>
            {t.retake}
          </GhostButton>
        </div>
        <div className="flex-1">
          <PrimaryButton onClick={onContinue}>{t.fixCta}</PrimaryButton>
        </div>
      </div>
    </>
  );
}
