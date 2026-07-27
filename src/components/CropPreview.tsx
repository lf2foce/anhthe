"use client";

/**
 * Xem trước ĐÚNG khung sẽ cắt ở server.
 *
 * Dùng chung hàm computeCrop với route /api/export, nên cái người dùng nhìn thấy
 * và cái file xuất ra là một. Khác biệt duy nhất là preview lấy độ sáng bằng CSS
 * filter còn export bằng sharp — hai công thức đã được ghép cho khớp nhau
 * (xem brightnessMultiplier ở lib/render.ts).
 */

import { computeCrop, type FaceLandmarks } from "@/lib/geometry";
import type { DocSpec } from "@/lib/docs";

export function CropPreview({
  photo,
  landmarks,
  imgW,
  imgH,
  spec,
  headScale = 1,
  brightness = 0,
  guides = false,
  crownLabel,
  className = "",
}: {
  photo: string;
  landmarks: FaceLandmarks;
  imgW: number;
  imgH: number;
  spec: DocSpec;
  headScale?: number;
  brightness?: number;
  guides?: boolean;
  crownLabel?: string;
  className?: string;
}) {
  const { crop } = computeCrop(landmarks, imgW, imgH, spec, headScale);

  const pct = (v: number) => `${v * 100}%`;
  const crownTop = (landmarks.crownY * imgH - crop.top) / crop.height;
  const eyeTop = (landmarks.eyeMidY * imgH - crop.top) / crop.height;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: `${spec.widthMm} / ${spec.heightMm}`,
        background: spec.background,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt=""
        className="absolute max-w-none"
        style={{
          width: pct(imgW / crop.width),
          height: pct(imgH / crop.height),
          left: pct(-crop.left / crop.width),
          top: pct(-crop.top / crop.height),
          filter: brightness ? `brightness(${1 + brightness / 140})` : undefined,
        }}
      />

      {guides ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent"
            style={{ top: pct(crownTop) }}
          />
          {crownLabel ? (
            <span
              className="pointer-events-none absolute left-2 -translate-y-full rounded-full bg-accent px-[7px] py-0.5 text-[9.5px] font-bold text-white"
              style={{ top: pct(crownTop) }}
            >
              {crownLabel}
            </span>
          ) : null}
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-g300/70"
            style={{ top: pct(eyeTop) }}
          />
        </>
      ) : null}
    </div>
  );
}
