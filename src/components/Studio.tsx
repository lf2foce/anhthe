"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { checkPhoto, exportFiles, fetchQuota, retouchPhoto } from "@/lib/api";
import { fileToPhoto } from "@/lib/capture";
import {
  BACKGROUNDS,
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
  exportBlock,
  exportGroups,
  failedBackgrounds,
  headScaleOf,
  originalWorking,
  pendingGroups,
  retouchGroups,
  variantKey,
  variantOf,
  workingFor,
  type Screen,
  type StudioState,
} from "@/lib/studio";
import { CreativeStudio } from "./creative/CreativeStudio";
import { Home } from "./screens/Home";
import { Capture } from "./screens/Capture";
import { Check } from "./screens/Check";
import { Edit } from "./screens/Edit";
import { Export } from "./screens/Export";
import { Done } from "./screens/Done";

export function Studio() {
  const [lang, setLang] = useState<Lang>("vi");
  const [s, setS] = useState<StudioState>(INITIAL);
  /**
   * Hai luồng tách hẳn: "id" = 6 màn compliance; "creative" = CreativeStudio tự
   * quản màn của nó. Không chung state — ảnh chụp cho ảnh thẻ và ảnh cho pack
   * sáng tạo là hai thứ khác nhau, trộn là sinh trạng thái vô nghĩa.
   */
  const [flow, setFlow] = useState<"id" | "creative">("id");
  /** Đời của lượt thay nền — chống kết quả lượt cũ ghi đè lượt mới */
  const retouchRun = useRef(0);
  /**
   * Số lượt còn lại hôm nay. Đọc lại sau MỖI thao tác tốn model — hiện sai số
   * lượt còn tệ hơn không hiện, vì khách sẽ tin vào con số rồi bị chặn giữa chừng.
   */
  const [quota, setQuota] = useState<{ remaining: number; perDay: number } | null>(
    null
  );
  const refreshQuota = useCallback(() => {
    fetchQuota().then(setQuota).catch(() => {});
  }, []);
  useEffect(refreshQuota, [refreshQuota]);

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
    // Đánh dấu đời của lượt để nút "Chuẩn hoá lại" bấm dồn không sinh hai vòng
    // cùng ghi. Kết quả về muộn của đời cũ vẫn ĐƯỢC ghi vào cache (nó đúng cho
    // version nó được sinh ra — key nói hộ), chỉ cờ retouching là của đời mới.
    const myRun = ++retouchRun.current;
    patch({ retouching: true, error: null });

    const evenLighting =
      s.check?.checks.some((c) => c.id === "lighting_even" && !c.pass) ?? false;

    try {
      for (const group of targets) {
        // Key chốt từ tham số THẬT gửi đi (bản chụp state lúc bấm) — người dùng
        // đổi toggle giữa chừng thì kết quả này vẫn nằm đúng ngăn của nó.
        const key = variantKey(s, group.background);
        const result = await retouchPhoto({
          photo: s.photo,
          docId: s.primary,
          // Mọi loại trong nhóm nền này — khung phải chứa được KHỔ CAO NHẤT,
          // không thì loại thêm sau bị lấp phẳng phần thân lúc xuất.
          docIds: group.docIds,
          landmarks: s.check!.landmarks,
          // Cỡ đầu quyết định khung rộng bao nhiêu, tức phải vẽ thêm bao nhiêu
          // thân. Không gửi thì server dựng theo target và "Chuẩn hoá lại" sau khi
          // kéo cỡ chẳng thay đổi được gì.
          headScale: headScaleOf(s, s.primary),
          background: group.background,
          smooth: s.smooth,
          evenLighting,
        });
        // GHÉP vào cache đang có, không thay cả cụm: thay cả cụm bằng bản chụp
        // cũ là xoá câm những version các vòng khác vừa ghi.
        setS((prev) => ({
          ...prev,
          retouched: { ...prev.retouched, [key]: result },
        }));
        if (retouchRun.current !== myRun) return;
      }
      if (retouchRun.current === myRun) patch({ retouching: false, files: null });
    } catch (e) {
      if (retouchRun.current === myRun)
        patch({ retouching: false, error: (e as Error).message });
    } finally {
      refreshQuota();
    }
  }

  const failed = failedBackgrounds(s);

  async function doExport() {
    const payload = exportGroups(s);
    if (payload.length === 0) return;
    patch({ exporting: true, error: null });
    try {
      const out = await exportFiles({
        groups: payload,
        sessionId: s.exportSessionId,
        brightness: s.brightness,
        headScales: s.headScales,
        sharpen: s.sharpen,
        sheet: s.sheet,
        sheetDocId: s.sheetDocId ?? s.primary,
      });
      patch({
        files: out.files,
        exportSessionId: out.sessionId,
        exporting: false,
        screen: "done",
      });
    } catch (e) {
      patch({ exporting: false, error: (e as Error).message });
    }
  }

  /**
   * Đổi nền không xoá gì — mỗi nền là một VERSION riêng trong cache, đổi qua
   * lại giữa các nền đã sinh là tức thì. (Luồng ảnh thẻ không còn tuỳ chọn AI
   * nào khác: mịn nhẹ nằm cứng trong mẫu chuẩn hoá chung — s.smooth luôn true.)
   */
  function setBgPref(bgPref: BackgroundId) {
    patch({ bgPref, files: null });
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
      <nav className="scr flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:justify-center">
        {SCREENS.map((screen, i) => {
          const on = s.screen === screen;
          const enabled = canGo(screen);
          return (
            <button
              key={screen}
              disabled={!enabled}
              onClick={() => patch({ screen, error: null })}
              // Chip kẹo: bước hiện tại = tím đậm nổi hẳn; bước tới được = thẻ
              // trắng; bước chưa tới = tự mờ nhờ button:disabled toàn cục.
              className={`flex flex-none items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[11.5px] font-bold ${
                on
                  ? "border-pop-ink bg-viol text-white shadow-[2px_2px_0_var(--color-pop-ink)]"
                  : "border-pop-ink/15 bg-white text-pop-ink/60"
              }`}
            >
              <span
                className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] font-bold ${
                  on ? "bg-white text-pop-ink" : "bg-pop-ink/10 text-pop-ink/60"
                }`}
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
  const quotaLine =
    quota === null ? null : (
      <span
        className={`rounded-full border-2 border-pop-ink px-2.5 py-1 text-[11px] font-bold ${
          quota.remaining === 0 ? "bg-pink-1 text-pink" : "bg-sun-1"
        }`}
      >
        {lang === "vi"
          ? `${quota.remaining}/${quota.perDay} lượt hôm nay`
          : `${quota.remaining}/${quota.perDay} left today`}
      </span>
    );

  return (
    // Shell SÁNG theo ngôn ngữ pop — ý "phòng tối" (khung nâu tối bao quanh)
    // bỏ hẳn: nó nhốt nội dung trong một hộp nặng nề và lệch tông với phần còn
    // lại của thương hiệu mới.
    // Nền TRƠN, không bóng bay trang trí: chúng sinh ra để làm mềm cái khung
    // tối cũ — khung bỏ rồi thì mảng màu mờ cùng tông ở góc đọc ra là vệt lỗi
    // chứ không phải chủ ý (khách chỉ đúng chỗ này). Trang trí là việc của
    // landing; trong app, ảnh của khách là thứ duy nhất được phép nổi.
    <div className="relative min-h-dvh overflow-x-clip bg-pop-bg px-3 py-4 font-body text-pop-ink sm:px-5 sm:py-6">
      {/* KHÔNG nhốt app trong khung điện thoại nữa. Khung 390px cứng làm app
          trông như bản demo và loại thẳng nhóm trả tiền nhiều nhất (tiệm ảnh,
          agency ngồi máy bàn). Giờ: mobile chiếm trọn màn, desktop là một thẻ
          rộng có chiều cao thật. Từng màn tự giới hạn bề rộng đọc được bên trong. */}
      <div className="relative mx-auto flex w-full max-w-[1120px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="font-display text-[21px] font-bold leading-none tracking-tight">
            {t.brand}
            <span className="pl-1 text-pink">✦</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {quotaLine}
            {(["vi", "en"] as const).map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`rounded-full border-2 px-3.5 py-1.5 text-[12px] font-bold ${
                  lang === code
                    ? "border-pop-ink bg-sun"
                    : "border-pop-ink/15 bg-white text-pop-ink/55"
                }`}
              >
                {code === "vi" ? "Tiếng Việt" : "English"}
              </button>
            ))}
          </div>
        </header>

        {rail}

        <main className="relative w-full">
          {/* THỬ NGHIỆM không khung: bỏ hộp viền mực — màn sáng (Home) tan thẳng
              vào nền shell như một trang liền mạch; màn tối (Chụp/Kiểm tra/Chỉnh
              sửa) tự thành tấm panel bo góc nổi trên nền sáng, không cần viền đỡ.
              Giữ nguyên cơ chế chiều cao + overflow: các màn thiết kế theo h-full
              và tự cuộn bên trong. */}
          <div className="h-[calc(100dvh-220px)] min-h-[540px] w-full overflow-hidden rounded-3xl sm:h-[calc(100dvh-200px)]">
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
              before={
                // Chỉ có gì để so khi bản đang xem KHÁC ảnh gốc.
                editWorking !== original ? original : null
              }
              spec={editSpec}
              bg={resolveBackground(editSpec, s.bgPref)}
              allowed={allowedBackgrounds(s.picked)}
              groups={groups}
              pendingCount={pending.length}
              failedBackgrounds={failed}
              brightness={s.brightness}
              headScale={headScaleOf(s, editSpec.id)}
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
              // Làm nét chạy lúc xuất file, không phải lúc thay nền — nên chỉ cần
              // bỏ `files` đã dựng, giữ nguyên bản đã thay nền.
              onSharpen={(sharpen) => patch({ sharpen, files: null })}
              onRetouch={() => runRetouch(pending)}
              onRetryBg={() =>
                runRetouch(groups.filter((g) => failed.includes(g.background)))
              }
              // Chạy lại = GHI ĐÈ version hiện tại của mọi nhóm. Không xoá gì:
              // runRetouch nhận targets tường minh nên không cần lừa pendingGroups,
              // và các version khác trong cache phải sống sót qua lần chạy này.
              onRedo={() => {
                patch({ files: null });
                runRetouch(groups);
              }}
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
              // "Sẵn sàng" là theo VERSION hiện tại — nền có bản mịn mà đang
              // tắt mịn thì vẫn tính là chưa sẵn. Quét MỌI nền chứ không chỉ
              // nhóm đang chọn: nền từng sinh rồi thì tick loại dùng nó là miễn phí.
              readyBackgrounds={BACKGROUNDS.map((b) => b.id).filter(
                (bg) => !!variantOf(s, bg)
              )}
              pendingCount={pending.length}
              block={exportBlock(s)}
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
            <Done
              t={t}
              lang={lang}
              files={s.files}
              sessionId={s.exportSessionId}
              onFiles={(files) => patch({ files })}
              onAgain={reset}
            />
          ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
