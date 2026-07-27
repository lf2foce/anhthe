/**
 * Bước 5 — xuất file.
 *
 * Không có model nào ở đây. Cùng một ảnh vào + cùng một landmark phải luôn cho
 * ra đúng từng byte kích thước như nhau, nên toàn bộ bước này là sharp thuần.
 *
 * Nhận NHIỀU nhóm, mỗi nhóm là một màu nền: một tấm ảnh chỉ có một nền, nên bộ
 * giấy tờ đòi nền khác nhau đến đây dưới dạng nhiều ảnh khác nhau, mỗi ảnh kèm
 * landmark đã đo lại trên chính nó.
 */

import {
  bgHex,
  getDoc,
  isBackgroundId,
  type BackgroundId,
  type DocSpec,
} from "@/lib/docs";
import { computeCrop, extendToFit, type FaceLandmarks } from "@/lib/geometry";
import { decodeDataUrl } from "@/lib/imageio";
import { newSessionId, storeImage, type StoredImage } from "@/lib/storage";
import { remainingFor } from "@/lib/gate";
import {
  BACKGROUND_TOLERANCE,
  backgroundDeviation,
  imageSize,
  renderSheet,
  renderSingle,
  sharpExtend,
} from "@/lib/render";

import { checkSize } from "@/lib/gate";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface ExportedFile {
  name: string;
  docId: string | null;
  label: string;
  meta: string;
  width: number;
  height: number;
  bytes: number;
  /** Ảnh trên kho: url xem được, key để mở khoá sau khi trả tiền */
  img: StoredImage;
  /** Ảnh gốc thiếu điểm ảnh, đã phải phóng to */
  upscaled: boolean;
  /** Vi phạm hình học / nền còn lại sau khi crop */
  warnings: string[];
}

/** Một màu nền + những giấy tờ dùng nền đó + ảnh đã thay sang nền đó */
export interface ExportGroup {
  photo: string;
  landmarks: FaceLandmarks;
  background: BackgroundId;
  docIds: string[];
}

interface Body {
  groups?: unknown;
  brightness?: number;
  /** Hệ số tỉ lệ đầu RIÊNG từng loại; thiếu thì coi là 1 (đúng target của loại đó) */
  headScales?: Record<string, number>;
  /** Làm nét bằng tích chập (không phải AI) — xem SHARPEN ở lib/render.ts */
  sharpen?: boolean;
  sheet?: boolean;
  sheetDocId?: string;
  /** Gom file của cùng một lượt xuất vào một thư mục */
  sessionId?: string;
}

function validLandmarks(lm: unknown): lm is FaceLandmarks {
  if (!lm || typeof lm !== "object") return false;
  const l = lm as Record<string, unknown>;
  return (["crownY", "chinY", "eyeMidY", "faceCenterX"] as const).every(
    (k) => typeof l[k] === "number" && Number.isFinite(l[k])
  );
}

interface ResolvedGroup {
  buffer: Buffer;
  landmarks: FaceLandmarks;
  hex: string;
  specs: DocSpec[];
}

/** Trả về lỗi dạng câu chữ, hoặc danh sách nhóm đã dựng xong */
function resolveGroups(raw: unknown): { error: string } | { groups: ResolvedGroup[] } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Thiếu nhóm ảnh để xuất." };
  }

  const groups: ResolvedGroup[] = [];
  const seenDocIds = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") return { error: "Nhóm ảnh không hợp lệ." };
    const g = item as Record<string, unknown>;

    if (!validLandmarks(g.landmarks)) {
      return { error: "Thiếu landmark khuôn mặt." };
    }
    if (!isBackgroundId(g.background)) {
      return { error: "Nền của nhóm không nằm trong danh mục cho phép." };
    }

    const ids = Array.isArray(g.docIds) ? g.docIds : [];
    const specs = ids
      .map((id) => (typeof id === "string" ? getDoc(id) : undefined))
      .filter((d): d is DocSpec => d !== undefined);
    if (specs.length === 0) return { error: "Nhóm không có loại giấy tờ nào hợp lệ." };

    // Một loại giấy tờ chỉ được thuộc một nhóm — nếu không thì cùng một spec ra
    // hai file cùng tên với hai nền khác nhau, và người dùng không biết cái nào đúng.
    for (const spec of specs) {
      if (seenDocIds.has(spec.id)) {
        return { error: `Loại "${spec.vi}" xuất hiện ở hai nhóm nền khác nhau.` };
      }
      seenDocIds.add(spec.id);
    }

    // Nền nhóm phải là nền spec CHO PHÉP — chốt cuối, không tin client.
    for (const spec of specs) {
      if (!spec.backgrounds.includes(g.background)) {
        return {
          error: `"${spec.vi}" không cho phép nền này — ảnh sẽ bị từ chối ở quầy.`,
        };
      }
    }

    let image;
    try {
      image = decodeDataUrl(g.photo);
    } catch (e) {
      return { error: (e as Error).message };
    }

    groups.push({
      buffer: image.buffer,
      landmarks: g.landmarks,
      hex: bgHex(g.background),
      specs,
    });
  }

  // Một phiên = MỘT họ giấy tờ. Chế độ tách ngay từ trang chủ nên trộn là trạng
  // thái vô nghĩa — và nếu trộn được thì ảnh chân dung (đã đổi áo, làm đẹp) sẽ đi
  // ra dưới dạng file visa. Chặn ở đây thay vì cảnh báo ở UI.
  const families = new Set(
    groups.flatMap((g) => g.specs.map((s) => s.family))
  );
  if (families.size > 1) {
    return {
      error:
        "Không xuất chung ảnh giấy tờ tuỳ thân với ảnh chân dung — hai chế độ cho phép sửa khác nhau.",
    };
  }

  return { groups };
}

export async function POST(request: Request) {
  // Trần dung lượng TRƯỚC khi đọc body — xem lib/gate.ts.
  const tooBig = checkSize(request);
  if (tooBig) return tooBig.response;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const resolved = resolveGroups(body.groups);
  if ("error" in resolved) {
    return Response.json({ error: resolved.error }, { status: 400 });
  }

  // Không gọi model nên KHÔNG trừ lượt — chỉ cần biết khách là ai để đặt khoá.
  const { clientId } = await remainingFor(request);
  const sessionId =
    typeof body.sessionId === "string" && /^[a-f0-9]{16}$/.test(body.sessionId)
      ? body.sessionId
      : newSessionId();

  const brightness = clampNum(body.brightness, -30, 30, 0);
  const headScaleOf = (docId: string) =>
    clampNum(body.headScales?.[docId], 0.85, 1.15, 1);

  try {
    const files: ExportedFile[] = [];

    for (const group of resolved.groups) {
      let { width, height } = await imageSize(group.buffer);
      let buffer = group.buffer;
      let landmarks = group.landmarks;

      // Nới khung khi ảnh chụp quá sát: thêm nền quanh đầu bằng số học, KHÔNG nhờ
      // model dịch người (đó là vẽ lại chủ thể). Chỉ hợp lệ khi nền đã phẳng đúng
      // màu — nếu không, chỗ nới sẽ lộ đường ghép, nên đo nền trước rồi mới nới.
      const scales = Object.fromEntries(
        group.specs.map((spec) => [spec.id, headScaleOf(spec.id)])
      );
      const plan = extendToFit(landmarks, width, height, group.specs, scales);
      if (plan.needed) {
        const srcDeviation = await backgroundDeviation(buffer, group.hex, {
          chinFraction: landmarks.chinY,
        });
        if (srcDeviation <= BACKGROUND_TOLERANCE) {
          buffer = await sharpExtend(buffer, plan.pad, group.hex);
          landmarks = plan.landmarks;
          width = plan.width;
          height = plan.height;
        }
        // Nền chưa chuẩn thì giữ nguyên — computeCrop bên dưới sẽ tự sinh cảnh báo
        // hình học như cũ, và cảnh báo nền cũng sẽ nổ. Không nới bừa.
      }

      for (const spec of group.specs) {
        const { crop, errors } = computeCrop(
          landmarks,
          width,
          height,
          spec,
          headScaleOf(spec.id)
        );
        const variant: "print" | "digital" = spec.digital ? "digital" : "print";
        const photo = await renderSingle(buffer, crop, spec, {
          brightness,
          variant,
          backgroundHex: group.hex,
          sharpen: !!body.sharpen,
        });

        const warnings = [...errors];
        // Đường cằm trong ẢNH ĐÃ CẮT, không phải trong ảnh gốc — vùng đo nền phải
        // theo hệ toạ độ của file thành phẩm.
        const chinFraction =
          (landmarks.chinY * height - crop.top) / crop.height;
        const deviation = await backgroundDeviation(photo.buffer, group.hex, {
          chinFraction,
        });
        if (deviation > BACKGROUND_TOLERANCE) {
          warnings.push(
            `Nền lệch khỏi màu chuẩn ${group.hex} (lệch ~${Math.round(
              deviation
            )}/255). Chạy lại bước thay nền trước khi nộp.`
          );
        }

        files.push({
          name: `anh-the-${spec.id}.jpg`,
          docId: spec.id,
          label: spec.vi,
          meta: `${spec.dim} · ${photo.width}×${photo.height} px · ${spec.dpi}dpi`,
          width: photo.width,
          height: photo.height,
          bytes: photo.buffer.length,
          img: await storeImage({
            clientId,
            sessionId,
            name: `anh-the-${spec.id}`,
            buffer: photo.buffer,
          }),
          upscaled: photo.upscaled,
          warnings,
        });
      }
    }

    if (body.sheet !== false) {
      // Tờ in thuộc về đúng nhóm nền của loại giấy tờ được chọn ghép — ghép ảnh
      // nền trắng cho loại đòi nền xám là in ra một tờ vô dụng.
      const group =
        resolved.groups.find((g) =>
          g.specs.some((s) => s.id === body.sheetDocId)
        ) ?? resolved.groups[0];
      const sheetSpec =
        group.specs.find((s) => s.id === body.sheetDocId) ?? group.specs[0];

      let { width, height } = await imageSize(group.buffer);
      let buffer = group.buffer;
      let landmarks = group.landmarks;
      const plan = extendToFit(landmarks, width, height, [sheetSpec], {
        [sheetSpec.id]: headScaleOf(sheetSpec.id),
      });
      if (plan.needed) {
        const srcDeviation = await backgroundDeviation(buffer, group.hex, {
          chinFraction: landmarks.chinY,
        });
        if (srcDeviation <= BACKGROUND_TOLERANCE) {
          buffer = await sharpExtend(buffer, plan.pad, group.hex);
          landmarks = plan.landmarks;
          width = plan.width;
          height = plan.height;
        }
      }
      // Bản in phải dùng kích thước IN, kể cả khi bản nộp online là digital.
      const { crop } = computeCrop(
        landmarks,
        width,
        height,
        sheetSpec,
        headScaleOf(sheetSpec.id)
      );
      const printPhoto = await renderSingle(buffer, crop, sheetSpec, {
        brightness,
        variant: "print",
        backgroundHex: group.hex,
        sharpen: !!body.sharpen,
      });
      const sheet = await renderSheet(printPhoto.buffer, sheetSpec);

      files.push({
        name: `ban-in-ghep-10x15-${sheetSpec.id}.jpg`,
        docId: null,
        label: `Bản in ghép 10×15 · ${sheetSpec.vi}`,
        meta: `${sheet.count} ảnh (${sheet.cols}×${sheet.rows}) · ${sheet.width}×${sheet.height} px · 300dpi`,
        width: sheet.width,
        height: sheet.height,
        bytes: sheet.buffer.length,
        img: await storeImage({
          clientId,
          sessionId,
          name: `ban-in-ghep-${sheetSpec.id}`,
          buffer: sheet.buffer,
        }),
        upscaled: printPhoto.upscaled,
        warnings: [],
      });
    }

    return Response.json({ files, sessionId });
  } catch (e) {
    console.error("[api/export]", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, v))
    : fallback;
}
