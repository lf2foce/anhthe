"use client";

import { useEffect, useState } from "react";
import { passCount, type CheckResult } from "@/lib/checks";
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
  result: CheckResult | null;
  error: string | null;
  onBack: () => void;
  onRetake: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="screen-in scr flex h-full flex-col gap-4 overflow-auto bg-n900 px-5 pb-7 pt-9 text-n100">
      <BackBar onBack={onBack} title={t.checkTitle} />

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
      <div className="relative aspect-[0.78] w-[150px] overflow-hidden rounded-[20px] bg-n800">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-x-0 h-[24%] animate-[sweep_1.6s_linear_infinite] bg-gradient-to-b from-transparent via-a400/60 to-transparent" />
      </div>
      <span className="text-[14px] font-bold">{t.scanning}</span>
      <div className="h-1.5 w-[70%] overflow-hidden rounded-full bg-n700">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11.5px] tracking-wide text-n400">{step}</span>
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
  result: CheckResult;
  onRetake: () => void;
  onContinue: () => void;
}) {
  const score = passCount(result.checks);
  const verdict =
    result.verdict === "pass"
      ? { title: t.verdictPass, sub: t.verdictSubPass }
      : result.verdict === "fixable"
        ? { title: t.verdictFixable, sub: t.verdictSubFixable }
        : { title: t.verdictFail, sub: t.verdictSubFail };

  return (
    <>
      <div className="flex items-center gap-4">
        <ScoreRing value={score} total={result.checks.length} />
        <div className="flex flex-col gap-1.5">
          <span
            className={`text-[14px] font-bold leading-tight ${
              result.verdict === "fail" ? "text-a300" : "text-g300"
            }`}
          >
            {verdict.title}
          </span>
          <span className="text-[11.5px] leading-snug text-n400">
            {verdict.sub}
          </span>
        </div>
      </div>

      <div className="flex flex-col">
        {result.checks.map((c) => (
          <div
            key={c.id}
            className="flex items-start gap-3 border-t border-n800 px-0.5 py-2.5"
          >
            <span className="pt-0.5">
              <Dot ok={c.pass} size={20} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12.5px] font-semibold leading-tight">
                {CHECK_LABELS[c.id]?.[lang] ?? c.id}
              </span>
              {!c.pass && c.detail ? (
                <span className="text-[11px] leading-snug text-a300">
                  {c.detail}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-n800 pt-3 text-[11px] text-n500">
        {result.fits.map((f) => {
          const doc = getDoc(f.docId);
          if (!doc) return null;
          return (
            <div key={f.docId} className="flex justify-between gap-3">
              <span>{lang === "vi" ? doc.vi : doc.en}</span>
              <span className={f.errors.length ? "text-a300" : "text-g400"}>
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
          <GhostButton onClick={onRetake}>{t.retake}</GhostButton>
        </div>
        <div className="flex-1">
          <PrimaryButton onClick={onContinue}>{t.fixCta}</PrimaryButton>
        </div>
      </div>
    </>
  );
}
