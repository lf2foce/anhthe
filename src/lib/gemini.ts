import "server-only";

import sharp from "sharp";
import { GoogleGenAI, Type } from "@google/genai";
import { AppError } from "./errors";
import type { FaceLandmarks } from "./geometry";
import { AI_CHECK_IDS, type AiCheckId } from "./checks";
import type { OutfitId } from "./docs";

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

/**
 * Bản đủ sức xuất 2K — chỉ dùng cho ảnh chân dung, khi người dùng bật `hiRes`.
 * Bản lite chỉ ra 1K nên không đủ cho ảnh in khổ lớn.
 */
export const IMAGE_MODEL_HIRES =
  process.env.GEMINI_IMAGE_MODEL_HIRES ?? "gemini-3.1-flash-image";

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
  if (!text)
    throw new AppError(
      "MODEL_NO_IMAGE",
      "AI không đọc được ảnh này. Thử lại giúp nhé.",
      502
    );

  let raw: RawAnalysis;
  try {
    raw = JSON.parse(text) as RawAnalysis;
  } catch {
    throw new AppError(
      "MODEL_NO_IMAGE",
      "AI không đọc được ảnh này. Thử lại giúp nhé.",
      502
    );
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

const OUTFIT_PROMPT: Record<Exclude<OutfitId, "keep">, string> = {
  shirt:
    "Đổi trang phục thành áo sơ mi trắng phẳng phiu, cổ áo gọn gàng, cài kín cổ.",
  suit:
    "Đổi trang phục thành vest tối màu lịch sự kèm áo sơ mi trắng bên trong, ve áo gọn.",
  blazer:
    "Đổi trang phục thành blazer lịch sự màu trung tính, bên trong áo trơn.",
};

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
  /**
   * Ba tuỳ chọn dưới đây CHỈ được bật cho ảnh chân dung. Route phải lọc qua
   * `sanitizeRetouch` trước khi gọi vào đây — xem FAMILY_TOOLKIT ở lib/docs.ts.
   */
  outfit: OutfitId;
  polish: boolean;
  hiRes: boolean;
  /**
   * Ảnh gửi lên đã được nới mép bằng nền phẳng, và model phải VẼ TIẾP người vào
   * phần nới đó. Bật khi ảnh gốc quá hẹp so với khung giấy tờ.
   */
  fillMargins: boolean;
}

/**
 * Dựng prompt sửa ảnh.
 *
 * Hai chế độ khác nhau ở CHỖ CĂN BẢN, không phải mức độ: ảnh giấy tờ tuỳ thân bị
 * cấm tường minh đổi mặt / đổi áo / đổi biểu cảm, còn ảnh chân dung thì mở những
 * thứ đó nhưng vẫn giữ một sàn: không đổi đặc điểm nhận dạng thành người khác.
 *
 * Xuất ra để test được — đây là chỗ dễ nhất để một dòng cấm bị rơi mất mà không ai
 * biết, và hậu quả chỉ hiện ra ở ảnh của khách.
 */
export function retouchPrompt(o: RetouchOptions): string {
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
  if (o.fillMargins)
    // Đặt TRƯỚC các việc khác: nếu model chỉ làm nền mà bỏ qua việc nối người,
    // ta được đúng cái đang có — vai cụt giữa nền phẳng.
    jobs.unshift(
      "Ảnh này đã được nới rộng khung: quanh mép có dải nền phẳng trống. Vẽ TIẾP phần thân và vai của chính người này vào dải trống đó cho liền mạch tự nhiên, như thể ảnh vốn được chụp lùi xa hơn. Phần đã có sẵn giữ NGUYÊN, không vẽ lại, không xê dịch."
    );
  if (o.outfit !== "keep") jobs.push(OUTFIT_PROMPT[o.outfit]);
  if (o.polish)
    jobs.push(
      "Chỉnh sáng cho da đều màu và mắt trong hơn một chút. KHÔNG đổi hình dáng mắt, mũi, miệng hay đường viền mặt."
    );
  if (o.hiRes)
    jobs.push(
      "Xuất ở độ phân giải cao nhất có thể, chi tiết rõ và sạch nhiễu, không làm ảnh trông như vẽ lại."
    );

  const portraitMode = o.outfit !== "keep" || o.polish || o.hiRes;

  // Sàn chung cho CẢ HAI chế độ: ảnh phải vẫn là người đó.
  const limits = [
    "KHÔNG đổi khuôn mặt thành người khác: giữ nguyên đường nét, tỉ lệ, màu mắt, kiểu tóc, độ tuổi.",
    // Khi đang nới mép thì câu "giữ nguyên khung" là MÂU THUẪN với việc vừa yêu
    // cầu — bảo model vừa vẽ thêm vừa không được đổi khung thì nó bỏ một trong hai.
    o.fillMargins
      ? "KHÔNG di chuyển, xoay, phóng to hay thu nhỏ người. Vị trí và kích thước của người trong ảnh phải giữ NGUYÊN; chỉ được vẽ thêm vào phần mép trống."
      : "KHÔNG di chuyển, xoay, phóng to, thu nhỏ hay cắt cúp lại người trong khung. Người phải ở NGUYÊN vị trí và NGUYÊN kích thước như ảnh gốc.",
    o.fillMargins
      ? "Giữ nguyên tỉ lệ khung của ảnh được cung cấp (đã bao gồm phần nới)."
      : "Giữ nguyên khung hình và tỉ lệ khung của ảnh gốc.",
  ];

  if (!portraitMode) {
    // Chỉ ảnh giấy tờ tuỳ thân mới bị siết mấy điều này.
    limits.push(
      "KHÔNG làm thon mặt, không mở to mắt, không đổi biểu cảm, không thêm nụ cười.",
      "KHÔNG đổi quần áo, không thêm trang sức, không xoá nốt ruồi hay sẹo.",
      "KHÔNG đổi cân nặng hay hình dáng cơ thể."
    );
  } else {
    limits.push(
      "KHÔNG xoá nốt ruồi, sẹo hay hình xăm trên mặt — đó là đặc điểm nhận dạng.",
      "KHÔNG làm thon mặt, không đổi hình dáng mắt mũi miệng."
    );
  }

  const header = portraitMode
    ? "Đây là ảnh chân dung dùng cho hồ sơ nghề nghiệp (LinkedIn, CV). Sửa ảnh theo đúng các việc sau và KHÔNG làm gì thêm:"
    : "Đây là ảnh dùng làm ảnh thẻ/hộ chiếu. Sửa ảnh theo đúng các việc sau và KHÔNG làm gì thêm:";

  const warning = portraitMode
    ? "RÀNG BUỘC BẮT BUỘC — ảnh phải vẫn nhận ra là chính người đó:"
    : "RÀNG BUỘC BẮT BUỘC — vi phạm là ảnh bị từ chối ở quầy:";

  return `${header}

${jobs.map((j, i) => `${i + 1}. ${j}`).join("\n")}

${warning}
${limits.map((l) => `- ${l}`).join("\n")}

Trả về ảnh đã sửa.`;
}

export interface RetouchResult {
  data: string;
  mimeType: string;
}

/**
 * Model hay trả PNG. Một ảnh 1K PNG ≈ 2,4MB base64; một lô 2 ảnh là ~4,8MB —
 * vượt trần body 4,5MB của Vercel, và trên 4G thì khách ngồi chờ tải về.
 * Chuyển sang JPEG ngay tại cửa cắt 75–85% byte mà mắt không phân biệt được.
 *
 * `flatten` là BẮT BUỘC và phải nêu MÀU tường minh: PNG có kênh alpha mà encode
 * thẳng sang JPEG thì phần trong suốt thành ĐEN. Nền đúng của ảnh là thứ chỉ
 * người gọi biết (thay nền: nền chuẩn của giấy tờ; sáng tạo: không có alpha).
 */
async function toJpeg(data: string, flattenTo: string): Promise<RetouchResult> {
  const buffer = await sharp(Buffer.from(data, "base64"))
    .flatten({ background: flattenTo })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  return { data: buffer.toString("base64"), mimeType: "image/jpeg" };
}

/** Một lần gọi model sinh ảnh: gửi ảnh + prompt, nhận về đúng một ảnh */
async function generateImage(opts: {
  model: string;
  image: ImageInput;
  prompt: string;
  aspectRatio: string;
  imageSize?: string;
  /** Màu lấp phần trong suốt khi model trả PNG có alpha */
  flattenTo: string;
}): Promise<RetouchResult> {
  // Bản lite KHÔNG nhận imageSize — gửi kèm là 400 "Image size 2K is not
  // supported" (đo thật 28/07/2026). Đặt GEMINI_IMAGE_SIZE mà quên đổi model
  // là chết cả route thay nền, nên bỏ tham số ở đây thay vì bắt env phải nhớ.
  const imageSize = opts.model.includes("lite") ? undefined : opts.imageSize;

  const res = await getClient().models.generateContent({
    model: opts.model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: opts.image.mimeType,
              data: opts.image.data,
            },
          },
          { text: opts.prompt },
        ],
      },
    ],
    config: {
      imageConfig: {
        aspectRatio: opts.aspectRatio,
        ...(imageSize ? { imageSize } : {}),
      },
    },
  });

  const parts = res.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return toJpeg(part.inlineData.data, opts.flattenTo);
    }
  }

  // Text từ chối của model là chuyện NỘI BỘ: log để tra, khách nhận câu Việt
  // gọn — không bao giờ dán lời model thô lên UI.
  const refusal = parts.find((p) => p.text)?.text;
  if (refusal) console.warn("[gemini] model refused:", refusal.slice(0, 300));
  throw new AppError(
    "MODEL_NO_IMAGE",
    "AI không trả về ảnh cho yêu cầu này. Thử lại giúp nhé.",
    502
  );
}

export async function retouch(o: RetouchOptions): Promise<RetouchResult> {
  // Bản lite chỉ ra 1K, nên bật hiRes phải đổi CẢ model, không chỉ imageSize.
  return generateImage({
    model: o.hiRes ? IMAGE_MODEL_HIRES : IMAGE_MODEL,
    image: o.image,
    prompt: retouchPrompt(o),
    aspectRatio: nearestAspectRatio(o.width, o.height),
    imageSize: o.hiRes ? (IMAGE_SIZE ?? "2K") : IMAGE_SIZE,
    // Nền chuẩn của loại giấy tờ — lấp alpha bằng bất cứ màu nào khác là hỏng
    // đúng thứ bước này vừa làm.
    flattenTo: o.backgroundHex,
  });
}

// ── Studio sáng tạo: vẽ lại toàn bộ theo phong cách ────────────────────────────

/**
 * Sinh ảnh phong cách cho luồng sáng tạo. Prompt do lib/packs.ts dựng — sàn danh
 * tính nằm ở đó và có test riêng.
 *
 * Dùng model KHÔNG-lite: pack vẽ lại toàn bộ khung cảnh nên chất lượng model là
 * sản phẩm, khác với thay nền (việc nhỏ, bản lite đủ).
 */
export async function stylize(o: {
  image: ImageInput;
  prompt: string;
  aspectRatio: string;
  /** "2K" khi người dùng chọn chất lượng cao — mặc định theo env/model */
  imageSize?: string;
}): Promise<RetouchResult> {
  return generateImage({
    model: IMAGE_MODEL_HIRES,
    image: o.image,
    prompt: o.prompt,
    aspectRatio: o.aspectRatio,
    imageSize: o.imageSize ?? IMAGE_SIZE,
    // Ảnh sáng tạo là cảnh đầy khung, không có alpha; trắng chỉ là chốt an toàn.
    flattenTo: "#ffffff",
  });
}
