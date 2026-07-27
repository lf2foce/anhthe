/** Trạng thái phiên chụp — dùng chung giữa Studio và các màn. */

import type { BackgroundId } from "./docs";
import type { CheckResult } from "./checks";
import type { FaceLandmarks } from "./geometry";
import type { ExportedFile } from "@/app/api/export/route";

export const SCREENS = [
  "home",
  "capture",
  "check",
  "edit",
  "export",
  "done",
] as const;

export type Screen = (typeof SCREENS)[number];

/** Ảnh đang dùng để xuất — hoặc ảnh gốc, hoặc bản đã thay nền */
export interface Working {
  photo: string;
  landmarks: FaceLandmarks;
  width: number;
  height: number;
}

export interface StudioState {
  screen: Screen;
  picked: string[];

  /** Ảnh gốc (data URL) từ camera hoặc file */
  photo: string | null;

  check: CheckResult | null;
  checking: boolean;

  bg: BackgroundId;
  brightness: number;
  /** Hệ số kéo tỉ lệ đầu quanh target của spec */
  headScale: number;
  smooth: boolean;
  retouched: Working | null;
  retouching: boolean;

  sheet: boolean;
  sheetDocId: string | null;
  files: ExportedFile[] | null;
  exporting: boolean;

  error: string | null;
}

export const INITIAL: StudioState = {
  screen: "home",
  picked: ["us", "vn34"],
  photo: null,
  check: null,
  checking: false,
  bg: "white",
  brightness: 0,
  headScale: 1,
  smooth: true,
  retouched: null,
  retouching: false,
  sheet: true,
  sheetDocId: null,
  files: null,
  exporting: false,
  error: null,
};

/**
 * Ảnh dùng cho crop/xuất: ưu tiên bản đã thay nền, vì landmark của bản đó đã
 * được đo lại trên chính nó.
 */
export function workingImage(s: StudioState): Working | null {
  if (s.retouched) return s.retouched;
  if (s.photo && s.check) {
    return {
      photo: s.photo,
      landmarks: s.check.landmarks,
      width: s.check.imageWidth,
      height: s.check.imageHeight,
    };
  }
  return null;
}

export function fileCount(s: StudioState): number {
  return s.picked.length + (s.sheet ? 1 : 0);
}
