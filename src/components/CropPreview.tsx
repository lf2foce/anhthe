"use client";

/**
 * Xem trước ĐÚNG khung sẽ cắt ở server.
 *
 * Dùng chung hàm computeCrop với route /api/export, nên cái người dùng nhìn thấy
 * và cái file xuất ra là một. Khác biệt duy nhất là preview lấy độ sáng bằng CSS
 * filter còn export bằng sharp — hai công thức đã được ghép cho khớp nhau
 * (xem brightnessMultiplier ở lib/render.ts).
 */

import {
  computeCrop,
  extendToFit,
  guideBands,
  type FaceLandmarks,
} from "@/lib/geometry";
import type { DocSpec } from "@/lib/docs";

/**
 * Một ràng buộc vị trí, vẽ thành DẢI chứ không phải một đường.
 *
 * Vẽ một đường chỉ nói "đỉnh đầu ở đây" — thông tin vô dụng, vì người dùng không
 * thuộc chuẩn để biết thế là đúng hay sai. Vẽ dải cho phép kèm đường thực tế nằm
 * trong/ngoài dải thì tự nó trả lời câu hỏi duy nhất khách quan tâm: **đạt chưa**.
 */
function Band({
  fromTop,
  toTop,
  atTop,
  ok,
  label,
}: {
  /** mép trên của dải, tỉ lệ 0..1 tính từ đỉnh khung */
  fromTop: number;
  toTop: number;
  /** vị trí thực tế */
  atTop: number;
  ok: boolean;
  label: string;
}) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const top = clamp(Math.min(fromTop, toTop));
  const height = clamp(Math.abs(toTop - fromTop));
  const line = clamp(atTop);
  const color = ok ? "var(--color-accent-2-400)" : "var(--color-accent)";

  return (
    <>
      {/* Dải cho phép */}
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: `${top * 100}%`,
          height: `${height * 100}%`,
          background: ok
            ? "color-mix(in srgb, var(--color-accent-2-400) 16%, transparent)"
            : "color-mix(in srgb, var(--color-accent) 14%, transparent)",
          borderTop: `1px dashed ${color}`,
          borderBottom: `1px dashed ${color}`,
        }}
      />
      {/* Vị trí thực tế */}
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{ top: `${line * 100}%`, borderTop: `2px solid ${color}` }}
      />
      {/* Nhãn nằm bên PHẢI, tránh đè nút quay lại ở góc trái */}
      <span
        className="pointer-events-none absolute right-1.5 -translate-y-1/2 rounded-full px-2 py-[3px] text-[9.5px] font-bold text-white"
        style={{ top: `${line * 100}%`, background: color }}
      >
        {label}
      </span>
    </>
  );
}

export function CropPreview({
  photo,
  landmarks,
  imgW,
  imgH,
  spec,
  backgroundHex,
  headScale = 1,
  brightness = 0,
  guides = false,
  labels,
  className = "",
}: {
  photo: string;
  landmarks: FaceLandmarks;
  imgW: number;
  imgH: number;
  spec: DocSpec;
  /** Nền đã resolve cho spec này — phải khớp cái /api/export dùng */
  backgroundHex: string;
  headScale?: number;
  brightness?: number;
  guides?: boolean;
  labels?: { crown: string; eye: string };
  className?: string;
}) {
  // Nới khung ảo giống evaluate/export: khung có thể thò ra ngoài ảnh gốc, và
  // phần thò ra hiện đúng màu nền container — chính là phần sẽ được sharp.extend
  // lấp lúc xuất. Nhờ vậy preview và file thật là một.
  const plan = extendToFit(landmarks, imgW, imgH, [spec], {
    [spec.id]: headScale,
  });
  const fit = computeCrop(plan.landmarks, plan.width, plan.height, spec, headScale);
  const crop = {
    left: fit.crop.left - plan.pad.left,
    top: fit.crop.top - plan.pad.top,
    width: fit.crop.width,
    height: fit.crop.height,
  };

  const pct = (v: number) => `${v * 100}%`;
  const bands = guideBands(landmarks, spec, fit);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: `${spec.widthMm} / ${spec.heightMm}`,
        background: backgroundHex,
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

      {guides && labels ? (
        <>
          <Band
            fromTop={bands.crown.from}
            toTop={bands.crown.to}
            atTop={bands.crown.at}
            ok={bands.crown.ok}
            label={`${labels.crown} ${(fit.headRatio * 100).toFixed(0)}%`}
          />
          <Band
            fromTop={bands.eye.from}
            toTop={bands.eye.to}
            atTop={bands.eye.at}
            ok={bands.eye.ok}
            label={`${labels.eye} ${(fit.eyeFromBottom * 100).toFixed(0)}%`}
          />
        </>
      ) : null}
    </div>
  );
}
