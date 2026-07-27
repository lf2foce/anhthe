import "server-only";

import { GoogleGenAI, Type } from "@google/genai";
import type { FaceLandmarks } from "./geometry";
import { AI_CHECK_IDS, type AiCheckId } from "./checks";

/**
 * Lớp mỏng bọc @google/genai.
 *
 * Ranh giới cố ý: model THỊ GIÁC chỉ trả về *quan sát* (landmark chuẩn hoá, đạt/
 * không đạt từng tiêu chí); model SINH ẢNH chỉ đổi *nền và da*. Mọi con số quyết
 * định kích thước file cuối đều tính bằng sharp ở lib/render.ts.
 */

/** Sinh & sửa ảnh. Mặc định bản lite (nhanh, rẻ, 1K). */
export const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";

/** Đọc & chấm ảnh. Không sinh pixel nào. */
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.5-flash-lite";

/**
 * Bản lite chỉ xuất 1K. Muốn ảnh in 300dpi cạnh dài lớn thì đặt
 * GEMINI_IMAGE_MODEL=gemini-3.1-flash-image và GEMINI_IMAGE_SIZE=2K.
 */
const IMAGE_SIZE = process.env.GEMINI_IMAGE_SIZE;

let client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Thiếu GEMINI_API_KEY. Tạo file .env.local với GEMINI_API_KEY=... (lấy ở https://aistudio.google.com/apikey)"
    );
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

export interface ImageInput {
  /** base64 thuần, không có tiền tố data: */
  data: string;
  mimeType: string;
}

// ── Đọc ảnh: landmark + 6 tiêu chí thị giác ────────────────────────────────

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    faceFound: {
      type: Type.BOOLEAN,
      description: "Có đúng một khuôn mặt người rõ ràng trong ảnh không",
    },
    crownY: {
      type: Type.INTEGER,
      description:
        "Toạ độ y của đỉnh đầu (điểm cao nhất của tóc), chuẩn hoá 0-1000 theo chiều cao ảnh",
    },
    chinY: {
      type: Type.INTEGER,
      description: "Toạ độ y của điểm thấp nhất của cằm, chuẩn hoá 0-1000",
    },
    eyeMidY: {
      type: Type.INTEGER,
      description: "Toạ độ y của trung điểm hai đồng tử, chuẩn hoá 0-1000",
    },
    faceCenterX: {
      type: Type.INTEGER,
      description:
        "Toạ độ x của trục dọc giữa khuôn mặt (giữa sống mũi), chuẩn hoá 0-1000",
    },
    checks: {
      type: Type.ARRAY,
      description: "Đúng 6 mục, mỗi id một lần",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, enum: [...AI_CHECK_IDS] },
          pass: { type: Type.BOOLEAN },
          detail: {
            type: Type.STRING,
            description:
              "Nếu không đạt: một câu ngắn tiếng Việt nói rõ sai ở đâu. Nếu đạt: chuỗi rỗng.",
          },
        },
        required: ["id", "pass", "detail"],
        propertyOrdering: ["id", "pass", "detail"],
      },
    },
  },
  required: [
    "faceFound",
    "crownY",
    "chinY",
    "eyeMidY",
    "faceCenterX",
    "checks",
  ],
  propertyOrdering: [
    "faceFound",
    "crownY",
    "chinY",
    "eyeMidY",
    "faceCenterX",
    "checks",
  ],
};

const ANALYSIS_PROMPT = `Bạn là máy kiểm định ảnh thẻ. Phân tích ảnh chân dung được cung cấp.

1. Đo 4 landmark, chuẩn hoá 0-1000 so với KÍCH THƯỚC ẢNH (x theo chiều rộng, y theo chiều cao, gốc ở góc trên-trái):
   - crownY: đỉnh cao nhất của tóc trên đầu (KHÔNG phải chân tóc).
   - chinY: điểm thấp nhất của cằm.
   - eyeMidY: trung điểm hai đồng tử.
   - faceCenterX: trục dọc giữa mặt.

2. Chấm đúng 6 tiêu chí sau, mỗi id một lần:
   - face_front: mặt hướng thẳng ống kính, không nghiêng/xoay quá 5 độ, vai cân.
   - eyes_open: hai mắt mở rõ, đồng tử không bị tóc/kính che, không loá phản quang.
   - neutral_expression: miệng khép, không cười hở răng, không nhíu mày.
   - background_even: nền phẳng, một màu, không hoạ tiết, KHÔNG có bóng đổ của người lên nền.
   - lighting_even: ánh sáng đều hai bên mặt, không một bên tối rõ rệt, không cháy sáng.
   - no_hat_no_glasses: không đội mũ/nón, không khăn trùm (trừ khăn tôn giáo), không đeo kính.

Chấm KHẮT KHE theo chuẩn ảnh hộ chiếu. Khi phân vân thì cho là KHÔNG đạt.
Trường detail viết tiếng Việt, một câu, chỉ điền khi không đạt.`;

export interface PhotoAnalysis {
  faceFound: boolean;
  landmarks: FaceLandmarks;
  checks: { id: AiCheckId; pass: boolean; detail: string }[];
}

interface RawAnalysis {
  faceFound: boolean;
  crownY: number;
  chinY: number;
  eyeMidY: number;
  faceCenterX: number;
  checks: { id: string; pass: boolean; detail: string }[];
}

export async function analyzePhoto(image: ImageInput): Promise<PhotoAnalysis> {
  const res = await getClient().models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: image.mimeType, data: image.data } },
          { text: ANALYSIS_PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: ANALYSIS_SCHEMA,
      temperature: 0,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Model không trả về nội dung phân tích.");

  let raw: RawAnalysis;
  try {
    raw = JSON.parse(text) as RawAnalysis;
  } catch {
    throw new Error("Không đọc được JSON phân tích từ model.");
  }

  const known = new Set<string>(AI_CHECK_IDS);
  const seen = new Set<string>();
  const checks: PhotoAnalysis["checks"] = [];
  for (const c of raw.checks ?? []) {
    if (!known.has(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    checks.push({
      id: c.id as AiCheckId,
      pass: !!c.pass,
      detail: typeof c.detail === "string" ? c.detail : "",
    });
  }
  // Tiêu chí model bỏ sót được coi là KHÔNG đạt — im lặng bỏ qua thì người dùng
  // tưởng đã kiểm mà thực ra chưa.
  for (const id of AI_CHECK_IDS) {
    if (!seen.has(id)) {
      checks.push({ id, pass: false, detail: "Model không chấm được tiêu chí này." });
    }
  }

  return {
    faceFound: !!raw.faceFound,
    landmarks: {
      crownY: raw.crownY / 1000,
      chinY: raw.chinY / 1000,
      eyeMidY: raw.eyeMidY / 1000,
      faceCenterX: raw.faceCenterX / 1000,
    },
    checks,
  };
}

// ── Sửa ảnh: thay nền (+ làm mịn da nhẹ) ───────────────────────────────────

/** Tỉ lệ khung hình model hỗ trợ, để bản sửa không bị đổi khung so với ảnh gốc. */
const SUPPORTED_RATIOS: [string, number][] = [
  ["21:9", 21 / 9],
  ["16:9", 16 / 9],
  ["5:4", 5 / 4],
  ["4:3", 4 / 3],
  ["3:2", 3 / 2],
  ["1:1", 1],
  ["2:3", 2 / 3],
  ["3:4", 3 / 4],
  ["4:5", 4 / 5],
  ["9:16", 9 / 16],
];

export function nearestAspectRatio(width: number, height: number): string {
  const target = width / height;
  let best = SUPPORTED_RATIOS[0];
  for (const cand of SUPPORTED_RATIOS) {
    if (Math.abs(cand[1] - target) < Math.abs(best[1] - target)) best = cand;
  }
  return best[0];
}

export interface RetouchOptions {
  image: ImageInput;
  width: number;
  height: number;
  /** Màu nền đích, hex */
  backgroundHex: string;
  /** Làm mịn da nhẹ */
  smooth: boolean;
  /** Sửa lệch sáng hai bên mặt do model báo */
  evenLighting: boolean;
}

function retouchPrompt(o: RetouchOptions): string {
  const jobs = [
    `Thay TOÀN BỘ nền phía sau người bằng màu đặc, phẳng, đúng mã hex ${o.backgroundHex}. Không gradient, không hoạ tiết, không bóng đổ lên nền.`,
    "Cắt viền sạch quanh tóc, tai và vai — giữ lại các sợi tóc mảnh, không để viền sáng hay quầng màu.",
  ];
  if (o.evenLighting)
    jobs.push(
      "Cân bằng ánh sáng hai bên khuôn mặt cho đều, xoá bóng tối một bên. Không đổi tông da."
    );
  if (o.smooth)
    jobs.push(
      "Làm mịn da RẤT NHẸ: chỉ giảm bóng dầu và vết đỏ. Giữ nguyên lỗ chân lông, nếp nhăn, nốt ruồi, râu."
    );

  return `Đây là ảnh dùng làm ảnh thẻ/hộ chiếu. Sửa ảnh theo đúng các việc sau và KHÔNG làm gì thêm:

${jobs.map((j, i) => `${i + 1}. ${j}`).join("\n")}

RÀNG BUỘC BẮT BUỘC — vi phạm là ảnh bị từ chối ở quầy:
- KHÔNG đổi khuôn mặt: không đổi hình dáng, tỉ lệ, đường nét, màu mắt, kiểu tóc, độ tuổi, cân nặng.
- KHÔNG làm thon mặt, không mở to mắt, không đổi biểu cảm, không thêm nụ cười.
- KHÔNG di chuyển, xoay, phóng to, thu nhỏ hay cắt cúp lại người trong khung. Người phải ở NGUYÊN vị trí và NGUYÊN kích thước như ảnh gốc.
- KHÔNG đổi quần áo, không thêm trang sức, không xoá nốt ruồi hay sẹo.
- Giữ nguyên khung hình và tỉ lệ khung của ảnh gốc.

Trả về ảnh đã sửa.`;
}

export interface RetouchResult {
  data: string;
  mimeType: string;
}

export async function retouch(o: RetouchOptions): Promise<RetouchResult> {
  const res = await getClient().models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: o.image.mimeType, data: o.image.data } },
          { text: retouchPrompt(o) },
        ],
      },
    ],
    config: {
      imageConfig: {
        aspectRatio: nearestAspectRatio(o.width, o.height),
        ...(IMAGE_SIZE ? { imageSize: IMAGE_SIZE } : {}),
      },
    },
  });

  const parts = res.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
      };
    }
  }

  const refusal = parts.find((p) => p.text)?.text;
  throw new Error(
    refusal
      ? `Model không trả về ảnh: ${refusal.slice(0, 200)}`
      : "Model không trả về ảnh nào."
  );
}
