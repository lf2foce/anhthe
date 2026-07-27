"use client";

import { useCallback, useState } from "react";
import { checkPhoto, exportFiles, retouchPhoto } from "@/lib/api";
import { fileToPhoto } from "@/lib/capture";
import {
  allowedBackgrounds,
  docsOf,
  familyOf,
  getDoc,
  resolveBackground,
  type BackgroundId,
} from "@/lib/docs";
import { COPY, type Lang } from "@/lib/i18n";
import {
  INITIAL,
  SCREENS,
  compliance,
  exportGroups,
  failedBackgrounds,
  fileCount,
  headScaleOf,
  originalWorking,
  pendingGroups,
  retouchGroups,
  workingFor,
  type Screen,
  type StudioState,
  type Working,
} from "@/lib/studio";
import { CreativeStudio } from "./creative/CreativeStudio";
import { Home } from "./screens/Home";
import { Capture } from "./screens/Capture";
import { Check } from "./screens/Check";
import { Edit } from "./screens/Edit";
import { Export } from "./screens/Export";
import { Done } from "./screens/Done";

export function Studio({
  imageModel,
  creativeModel,
  textModel,
}: {
  imageModel: string;
  /** Model của Studio sáng tạo — bản không-lite, khác model thay nền */
  creativeModel: string;
  textModel: string;
}) {
  const [lang, setLang] = useState<Lang>("vi");
  const [s, setS] = useState<StudioState>(INITIAL);
  /**
   * Hai luồng tách hẳn: "id" = 6 màn compliance; "creative" = CreativeStudio tự
   * quản màn của nó. Không chung state — ảnh chụp cho ảnh thẻ và ảnh cho pack
   * sáng tạo là hai thứ khác nhau, trộn là sinh trạng thái vô nghĩa.
   */
  const [flow, setFlow] = useState<"id" | "creative">("id");

  const t = COPY[lang];
  const patch = useCallback(
    (p: Partial<StudioState>) => setS((prev) => ({ ...prev, ...p })),
    []
  );

  const original = originalWorking(s);
  // Màn Chỉnh sửa chỉ canh cho loại CHÍNH — loại tấm ảnh được chụp cho.
  const editSpec = getDoc(s.primary) ?? getDoc(INITIAL.primary)!;
  // Preview phải là ảnh của ĐÚNG nhóm nền của loại đang xem, không phải "một bản
  // đã sửa" chung — nếu không, người dùng thấy nền trắng rồi nhận file nền xám.
  const editWorking = workingFor(s, editSpec.id) ?? original;
  const groups = retouchGroups(s);
  const pending = pendingGroups(s);
  const fit = compliance(s);
  const idDocs = docsOf("id");

  // ── hành động ────────────────────────────────────────────────────────────

  /** Chọn loại chính ở trang chủ — reset tập xuất về đúng loại đó */
  function pickPrimary(id: string) {
    setS((prev) => ({ ...prev, primary: id, picked: [id], files: null }));
  }

  /**
   * Tick thêm / bỏ loại ở màn Xuất ảnh. Loại chính không bỏ được, và chỉ tick được
   * loại CÙNG HỌ — trộn hai chế độ là trạng thái vô nghĩa, chặn ở đây chứ không
   * cảnh báo sau.
   */
  function toggleDoc(id: string) {
    setS((prev) => {
      if (id === prev.primary) return prev;
      if (familyOf(id) !== familyOf(prev.primary)) return prev;
      return {
        ...prev,
        picked: prev.picked.includes(id)
          ? prev.picked.filter((x) => x !== id)
          : [...prev.picked, id],
        files: null,
      };
    });
  }

  const runCheck = useCallback(
    async (photo: string) => {
      patch({
        photo,
        screen: "check",
        checking: true,
        check: null,
        error: null,
        retouched: {},
        files: null,
      });
      try {
        const result = await checkPhoto(photo);
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
      await runCheck(photo);
    } catch (e) {
      patch({ screen: "check", checking: false, error: (e as Error).message });
    }
  }

  /**
   * Thay nền cho một danh sách nhóm. Một tấm ảnh chỉ có một màu nền, nên bộ giấy
   * tờ đòi hai nền khác nhau là hai lần gọi model — không có cách gộp.
   *
   * Nhận `targets` tường minh thay vì tự đọc state, để nút "thử lại" chạy đúng
   * những nhóm đã thất bại mà không phải chờ state mới.
   */
  async function runRetouch(targets: typeof groups) {
    if (!s.photo || targets.length === 0) return;
    patch({ retouching: true, error: null });

    const evenLighting =
      s.check?.checks.some((c) => c.id === "lighting_even" && !c.pass) ?? false;
    const done: Partial<Record<BackgroundId, Working>> = { ...s.retouched };

    try {
      for (const group of targets) {
        done[group.background] = await retouchPhoto({
          photo: s.photo,
          docId: s.primary,
          background: group.background,
          smooth: s.smooth,
          evenLighting,
        });
        // Ghi từng nhóm xong ngay: nhóm sau lỗi thì nhóm trước vẫn dùng được.
        setS((prev) => ({ ...prev, retouched: { ...done } }));
      }
      patch({ retouching: false, files: null });
    } catch (e) {
      patch({ retouching: false, error: (e as Error).message });
    }
  }

  const failed = failedBackgrounds(s);

  async function doExport() {
    const payload = exportGroups(s);
    if (payload.length === 0) return;
    patch({ exporting: true, error: null });
    try {
      const { files } = await exportFiles({
        groups: payload,
        brightness: s.brightness,
        headScales: s.headScales,
        sharpen: s.sharpen,
        sheet: s.sheet,
        sheetDocId: s.sheetDocId ?? s.primary,
      });
      patch({ files, exporting: false, screen: "done" });
    } catch (e) {
      patch({ exporting: false, error: (e as Error).message });
    }
  }

  /**
   * Đổi nền không xoá bản đã sửa: bản nền trắng vẫn đúng cho mọi loại đòi nền
   * trắng. Chỉ danh sách nhóm là thay đổi. Đổi mức làm mịn thì khác — bản cũ sinh
   * ra bằng tham số khác nên phải bỏ hết.
   */
  function setBgPref(bgPref: BackgroundId) {
    patch({ bgPref, files: null });
  }
  function setSmooth(smooth: boolean) {
    patch({ smooth, retouched: {}, files: null });
  }

  function reset() {
    setS({ ...INITIAL, primary: s.primary, picked: [s.primary] });
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
        return !!original;
      case "done":
        return !!s.files;
    }
  }

  // Rail + dòng model dùng ở HAI chỗ: cột trái (màn rộng) và dưới khung máy
  // (màn hẹp) — định nghĩa một lần để hai bản không trôi khỏi nhau.
  const rail =
    flow === "creative" ? null : (
      <nav className="flex max-w-[660px] flex-wrap justify-center gap-2 lg:justify-start">
        {SCREENS.map((screen, i) => {
          const on = s.screen === screen;
          const enabled = canGo(screen);
          return (
            <button
              key={screen}
              disabled={!enabled}
              onClick={() => patch({ screen, error: null })}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold shadow-[inset_0_0_0_1.5px_var(--color-neutral-800)]"
              style={{
                color: on ? "var(--color-neutral-100)" : "var(--color-neutral-500)",
              }}
            >
              <span
                className="grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] font-bold"
                style={{
                  background: on
                    ? "var(--color-accent)"
                    : "var(--color-neutral-800)",
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
    );

  // Tên model đọc từ server để nhãn này không nói một đằng chạy một nẻo khi
  // đổi GEMINI_IMAGE_MODEL / GEMINI_TEXT_MODEL.
  const modelLine = (
    <p className="m-0 text-[11px] text-n600">
      {flow === "creative"
        ? lang === "vi"
          ? `Studio sáng tạo · vẽ bằng ${creativeModel}`
          : `Creative studio · drawn by ${creativeModel}`
        : lang === "vi"
          ? `${fileCount(s)} tệp sẽ được xuất · sửa ảnh ${imageModel} · chấm ${textModel}`
          : `${fileCount(s)} files to export · retouch ${imageModel} · grading ${textModel}`}
    </p>
  );

  return (
    <div className="relative min-h-dvh bg-n900 px-5 py-8 text-n100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-g800 opacity-55 blur-[110px]" />
        <div className="absolute -bottom-52 -right-36 h-[460px] w-[460px] rounded-full bg-a800 opacity-50 blur-[110px]" />
      </div>

      {/* Màn rộng: chữ nghĩa dồn cột TRÁI, khung máy đứng PHẢI và cao gần hết
          màn hình — header không còn ăn mất chiều cao của khung. Màn hẹp: xếp
          dọc như cũ. */}
      <div className="relative mx-auto flex max-w-[1060px] flex-col items-center gap-6 lg:min-h-[calc(100dvh-64px)] lg:flex-row lg:items-center lg:justify-center lg:gap-16">
        <div className="flex w-full max-w-[402px] flex-col items-start gap-5 lg:w-[380px] lg:max-w-none">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-a300">
              {t.brand} · v2
            </span>
            <span className="font-display text-[34px] font-bold leading-none">
              Ảnh thẻ Studio
            </span>
            <span className="max-w-[46ch] text-[13.5px] text-n400">
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
          <div className="hidden flex-col gap-4 lg:flex">
            {rail}
            {modelLine}
          </div>
        </div>

        {/* Đúng kích thước iPhone 14: 390×844, BỀ NGANG là gốc.
            Lấy chiều cao làm gốc (aspect + h-[min(...)]) là sai — cửa sổ thấp thì
            máy teo ngang còn ~290px, chữ vỡ và nút bẹp. Thà để trang cuộn dọc.
            Bo góc 47px ≈ tỉ lệ bo thật của máy (~12% bề ngang). */}
        <main className="relative flex-none">
          <div className="aspect-[390/844] w-[390px] max-w-full overflow-hidden rounded-[47px] bg-n900 shadow-[0_24px_60px_rgba(0,0,0,.45)] ring-1 ring-n700">
          {flow === "creative" ? (
            <CreativeStudio t={t} lang={lang} onExit={() => setFlow("id")} />
          ) : null}

          {flow === "id" && s.screen === "home" ? (
            <Home
              t={t}
              lang={lang}
              docs={idDocs}
              primary={s.primary}
              onPick={pickPrimary}
              onShoot={() => patch({ screen: "capture" })}
              onUpload={uploadFromHome}
              onCreative={() => setFlow("creative")}
            />
          ) : null}

          {flow === "id" && s.screen === "capture" ? (
            <Capture
              t={t}
              onBack={() => patch({ screen: "home" })}
              onPhoto={(photo) => runCheck(photo)}
            />
          ) : null}

          {flow === "id" && s.screen === "check" ? (
            <Check
              t={t}
              lang={lang}
              photo={s.photo}
              checking={s.checking}
              result={fit}
              error={s.error}
              onBack={() => patch({ screen: "home", error: null })}
              onRetake={() => patch({ screen: "capture", error: null })}
              onContinue={() => patch({ screen: "edit", error: null })}
            />
          ) : null}

          {flow === "id" && s.screen === "edit" && editWorking ? (
            <Edit
              t={t}
              lang={lang}
              working={editWorking}
              spec={editSpec}
              bg={resolveBackground(editSpec, s.bgPref)}
              allowed={allowedBackgrounds(s.picked)}
              groups={groups}
              pendingCount={pending.length}
              failedBackgrounds={failed}
              brightness={s.brightness}
              headScale={headScaleOf(s, editSpec.id)}
              smooth={s.smooth}
              sharpen={s.sharpen}
              retouching={s.retouching}
              error={s.error}
              onBg={setBgPref}
              onBrightness={(brightness) => patch({ brightness, files: null })}
              // Thanh trượt chỉ tác động lên loại CHÍNH; các cỡ khác canh theo
              // target riêng của chúng.
              onHeadScale={(v) =>
                patch({
                  headScales: { ...s.headScales, [editSpec.id]: v },
                  files: null,
                })
              }
              onSmooth={setSmooth}
              // Làm nét chạy lúc xuất file, không phải lúc thay nền — nên chỉ cần
              // bỏ `files` đã dựng, giữ nguyên bản đã thay nền.
              onSharpen={(sharpen) => patch({ sharpen, files: null })}
              onRetouch={() => runRetouch(pending)}
              onRetryBg={() =>
                runRetouch(groups.filter((g) => failed.includes(g.background)))
              }
              onBack={() => patch({ screen: "check", error: null })}
              onNext={() => patch({ screen: "export", error: null })}
            />
          ) : null}

          {flow === "id" && s.screen === "export" && original ? (
            <Export
              t={t}
              lang={lang}
              workingFor={(docId) => workingFor(s, docId) ?? original}
              backgroundFor={(spec) => resolveBackground(spec, s.bgPref)}
              headScaleOf={(docId) => headScaleOf(s, docId)}
              docs={idDocs}
              primary={s.primary}
              picked={s.picked}
              onToggle={toggleDoc}
              compliance={fit}
              pendingCount={pending.length}
              retouching={s.retouching}
              onRetouch={() => runRetouch(pending)}
              brightness={s.brightness}
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

          {flow === "id" && s.screen === "done" && s.files ? (
            <Done t={t} lang={lang} files={s.files} onAgain={reset} />
          ) : null}
          </div>
        </main>

        <div className="flex flex-col items-center gap-4 lg:hidden">
          {rail}
          {modelLine}
        </div>
      </div>
    </div>
  );
}
