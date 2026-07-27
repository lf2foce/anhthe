"use client";

import { useCallback, useState } from "react";
import { checkPhoto, exportFiles, retouchPhoto } from "@/lib/api";
import { fileToPhoto } from "@/lib/capture";
import { getDoc, type BackgroundId } from "@/lib/docs";
import { COPY, type Lang } from "@/lib/i18n";
import {
  INITIAL,
  SCREENS,
  fileCount,
  workingImage,
  type Screen,
  type StudioState,
} from "@/lib/studio";
import { Home } from "./screens/Home";
import { Capture } from "./screens/Capture";
import { Check } from "./screens/Check";
import { Edit } from "./screens/Edit";
import { Export } from "./screens/Export";
import { Done } from "./screens/Done";

export function Studio() {
  const [lang, setLang] = useState<Lang>("vi");
  const [s, setS] = useState<StudioState>(INITIAL);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const t = COPY[lang];
  const patch = useCallback(
    (p: Partial<StudioState>) => setS((prev) => ({ ...prev, ...p })),
    []
  );

  const working = workingImage(s);
  const editSpec =
    getDoc(previewDocId ?? "") ?? getDoc(s.picked[0] ?? "") ?? getDoc("vn34")!;

  // ── hành động ────────────────────────────────────────────────────────────

  function toggleDoc(id: string) {
    setS((prev) => ({
      ...prev,
      picked: prev.picked.includes(id)
        ? prev.picked.filter((x) => x !== id)
        : [...prev.picked, id],
      files: null,
    }));
  }

  const runCheck = useCallback(
    async (photo: string, docIds: string[]) => {
      patch({
        photo,
        screen: "check",
        checking: true,
        check: null,
        error: null,
        retouched: null,
        files: null,
      });
      try {
        const result = await checkPhoto(photo, docIds);
        patch({ check: result, checking: false });
      } catch (e) {
        patch({ checking: false, error: (e as Error).message });
      }
    },
    [patch]
  );

  async function uploadFromHome(file: File) {
    try {
      const photo = await fileToPhoto(file);
      await runCheck(photo, s.picked);
    } catch (e) {
      patch({ screen: "check", checking: false, error: (e as Error).message });
    }
  }

  async function doRetouch() {
    if (!s.photo) return;
    patch({ retouching: true, error: null });
    try {
      const evenLighting =
        s.check?.checks.some((c) => c.id === "lighting_even" && !c.pass) ?? false;
      const out = await retouchPhoto({
        photo: s.photo,
        background: s.bg,
        smooth: s.smooth,
        evenLighting,
      });
      patch({ retouched: out, retouching: false, files: null });
    } catch (e) {
      patch({ retouching: false, error: (e as Error).message });
    }
  }

  async function doExport() {
    if (!working) return;
    patch({ exporting: true, error: null });
    try {
      const { files } = await exportFiles({
        photo: working.photo,
        landmarks: working.landmarks,
        docIds: s.picked,
        brightness: s.brightness,
        headScale: s.headScale,
        sheet: s.sheet,
        sheetDocId: s.sheetDocId ?? s.picked[0] ?? null,
      });
      patch({ files, exporting: false, screen: "done" });
    } catch (e) {
      patch({ exporting: false, error: (e as Error).message });
    }
  }

  /** Đổi nền hoặc mức làm mịn thì bản đã sửa không còn đúng nữa — bỏ đi, đừng xuất nhầm. */
  function setBg(bg: BackgroundId) {
    patch({ bg, retouched: null, files: null });
  }
  function setSmooth(smooth: boolean) {
    patch({ smooth, retouched: null, files: null });
  }

  function reset() {
    setS({ ...INITIAL, picked: s.picked });
    setPreviewDocId(null);
  }

  /** Rail chỉ nhảy tới được màn đã đủ dữ liệu — không có màn rỗng. */
  function canGo(screen: Screen): boolean {
    switch (screen) {
      case "home":
      case "capture":
        return true;
      case "check":
        return !!s.photo;
      case "edit":
      case "export":
        return !!working;
      case "done":
        return !!s.files;
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center gap-6 overflow-hidden bg-n900 px-5 pb-10 pt-8 text-n100">
      <div className="pointer-events-none absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-g800 opacity-55 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-52 -right-36 h-[460px] w-[460px] rounded-full bg-a800 opacity-50 blur-[110px]" />

      <header className="relative flex w-full max-w-[980px] flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-a300">
            {t.brand} · v2
          </span>
          <span className="font-display text-[34px] font-bold leading-none">
            Ảnh thẻ Studio
          </span>
          <span className="max-w-[54ch] text-[13.5px] text-n400">
            {t.tagline}
          </span>
        </div>
        <div className="flex gap-1.5">
          {(["vi", "en"] as const).map((code) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className="rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[inset_0_0_0_1.5px_var(--color-neutral-700)]"
              style={{
                color:
                  lang === code
                    ? "var(--color-accent-300)"
                    : "var(--color-neutral-500)",
              }}
            >
              {code === "vi" ? "Tiếng Việt" : "English"}
            </button>
          ))}
        </div>
      </header>

      <main className="relative w-full max-w-[402px] flex-none">
        <div className="h-[min(874px,calc(100dvh-260px))] min-h-[600px] overflow-hidden rounded-[40px] bg-n900 shadow-[0_24px_60px_rgba(0,0,0,.45)] ring-1 ring-n700">
          {s.screen === "home" ? (
            <Home
              t={t}
              lang={lang}
              picked={s.picked}
              onToggle={toggleDoc}
              onShoot={() => patch({ screen: "capture" })}
              onUpload={uploadFromHome}
            />
          ) : null}

          {s.screen === "capture" ? (
            <Capture
              t={t}
              onBack={() => patch({ screen: "home" })}
              onPhoto={(photo) => runCheck(photo, s.picked)}
            />
          ) : null}

          {s.screen === "check" ? (
            <Check
              t={t}
              lang={lang}
              photo={s.photo}
              checking={s.checking}
              result={s.check}
              error={s.error}
              onBack={() => patch({ screen: "home", error: null })}
              onRetake={() => patch({ screen: "capture", error: null })}
              onContinue={() => patch({ screen: "edit", error: null })}
            />
          ) : null}

          {s.screen === "edit" && working ? (
            <Edit
              t={t}
              lang={lang}
              working={working}
              spec={editSpec}
              picked={s.picked}
              previewDocId={editSpec.id}
              onPreviewDoc={setPreviewDocId}
              bg={s.bg}
              brightness={s.brightness}
              headScale={s.headScale}
              smooth={s.smooth}
              retouched={!!s.retouched}
              retouching={s.retouching}
              error={s.error}
              onBg={setBg}
              onBrightness={(brightness) => patch({ brightness, files: null })}
              onHeadScale={(headScale) => patch({ headScale, files: null })}
              onSmooth={setSmooth}
              onRetouch={doRetouch}
              onBack={() => patch({ screen: "check", error: null })}
              onNext={() => patch({ screen: "export", error: null })}
            />
          ) : null}

          {s.screen === "export" && working ? (
            <Export
              t={t}
              lang={lang}
              working={working}
              picked={s.picked}
              onToggle={toggleDoc}
              brightness={s.brightness}
              headScale={s.headScale}
              sheet={s.sheet}
              onSheet={(sheet) => patch({ sheet, files: null })}
              sheetDocId={s.sheetDocId}
              onSheetDoc={(sheetDocId) => patch({ sheetDocId, files: null })}
              exporting={s.exporting}
              error={s.error}
              onBack={() => patch({ screen: "edit", error: null })}
              onExport={doExport}
            />
          ) : null}

          {s.screen === "done" && s.files ? (
            <Done t={t} lang={lang} files={s.files} onAgain={reset} />
          ) : null}
        </div>
      </main>

      <nav className="relative flex max-w-[660px] flex-wrap justify-center gap-2">
        {SCREENS.map((screen, i) => {
          const on = s.screen === screen;
          const enabled = canGo(screen);
          return (
            <button
              key={screen}
              disabled={!enabled}
              onClick={() => patch({ screen, error: null })}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold shadow-[inset_0_0_0_1.5px_var(--color-neutral-800)]"
              style={{ color: on ? "var(--color-neutral-100)" : "var(--color-neutral-500)" }}
            >
              <span
                className="grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] font-bold"
                style={{
                  background: on ? "var(--color-accent)" : "var(--color-neutral-800)",
                  color: on ? "#fff" : "var(--color-neutral-400)",
                }}
              >
                {i + 1}
              </span>
              {t.rail[i]}
            </button>
          );
        })}
      </nav>

      <p className="relative text-[11px] text-n600">
        {lang === "vi"
          ? `${fileCount(s)} tệp sẽ được xuất · AI dùng Gemini 3.1 Flash Image`
          : `${fileCount(s)} files to export · powered by Gemini 3.1 Flash Image`}
      </p>
    </div>
  );
}
