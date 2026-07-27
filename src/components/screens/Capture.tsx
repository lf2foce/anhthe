"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fileToPhoto, videoToPhoto } from "@/lib/capture";
import type { Copy } from "@/lib/i18n";
import { BackBar, ErrorNote, GhostButton, PrimaryButton } from "@/components/ui";

type CamState = "starting" | "live" | "denied";

export function Capture({
  t,
  onBack,
  onPhoto,
}: {
  t: Copy;
  onBack: () => void;
  onPhoto: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [cam, setCam] = useState<CamState>("starting");
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCam("denied");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1080 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCam("live");
      } catch {
        if (!cancelled) setCam("denied");
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  function shoot() {
    try {
      if (!videoRef.current) return;
      setShot(videoToPhoto(videoRef.current));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function pickFile(file: File) {
    try {
      setShot(await fileToPhoto(file));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="[&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[600px] screen-in flex h-full flex-col gap-3.5 bg-n900 px-4 pb-6 pt-8 text-n100">
      <BackBar onBack={onBack} title={t.capTitle} />

      <div className="relative flex-1 overflow-hidden rounded-[28px] bg-n800 ring-1 ring-n700">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {cam === "denied" && !shot ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-[12.5px] text-n400">
            {t.camDenied}
          </div>
        ) : null}

        {!shot ? (
          <>
            <div className="pointer-events-none absolute left-1/2 top-[48%] aspect-[0.78] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[2.5px] border-accent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/55 to-transparent p-3.5">
              {t.tips.map((tip) => (
                <div key={tip} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 flex-none animate-[pulse_2.2s_ease-in-out_infinite] rounded-full bg-g300" />
                  <span className="text-[11.5px] leading-tight text-n100">
                    {tip}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {shot ? (
        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={() => onPhoto(shot)}>{t.useThis}</PrimaryButton>
          <GhostButton onClick={() => setShot(null)}>
            {t.retakeShort}
          </GhostButton>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[11.5px] font-bold text-n400">
              {cam === "starting" ? t.camStarting : ""}
            </span>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[11.5px] font-semibold text-a300 underline underline-offset-2"
            >
              {t.useUpload}
            </button>
          </div>
          <button
            onClick={shoot}
            disabled={cam !== "live"}
            aria-label={t.shutterHint}
            className="grid h-[78px] w-[78px] flex-none place-self-center place-items-center rounded-full shadow-[inset_0_0_0_3px_var(--color-neutral-100)]"
          >
            <span className="h-[60px] w-[60px] rounded-full bg-accent" />
          </button>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) pickFile(f);
        }}
      />
    </div>
  );
}
