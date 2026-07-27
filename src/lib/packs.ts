/**
 * Registry phong cách cho Studio sáng tạo — luồng thứ hai, TÁCH HẲN luồng ảnh thẻ.
 *
 * Khác biệt căn bản với luồng ảnh thẻ: ở đây model được phép VẼ LẠI TOÀN BỘ —
 * trang phục, bối cảnh, ánh sáng, kiểu tóc — vì sản phẩm là ảnh sáng tạo, không
 * phải giấy tờ pháp lý. Không có compliance, không landmark, không computeCrop.
 *
 * Thứ DUY NHẤT không được đổi là danh tính: `IDENTITY_FLOOR` đi vào MỌI prompt.
 * Đó là sàn của cả luồng, và có test canh để không dòng nào rơi mất.
 */

export interface StylePack {
  id: string;
  vi: string;
  en: string;
  subVi: string;
  subEn: string;
  /** Nền CSS dự phòng cho ô gallery khi ảnh mẫu chưa tải xong / thiếu file */
  gradient: string;
  /** Phần prompt riêng của pack: bối cảnh, trang phục, ánh sáng */
  scene: string;
  /** Tỉ lệ khung mặc định — người dùng đổi được trong bước tuỳ chỉnh */
  aspectRatio: AspectChoice;
  /** Ảnh mẫu trong public/ — người mẫu HƯ CẤU do AI tạo, sinh bằng gen-thumbs.mjs */
  thumb: string;
}

/** Các khung người dùng chọn được — tập con danh sách model hỗ trợ */
export const ASPECT_CHOICES = ["1:1", "3:4", "4:5", "9:16"] as const;
export type AspectChoice = (typeof ASPECT_CHOICES)[number];

export function isAspectChoice(v: unknown): v is AspectChoice {
  return ASPECT_CHOICES.includes(v as AspectChoice);
}

export const PACKS: StylePack[] = [
  {
    id: "pro",
    thumb: "/packs/pro.jpg",
    vi: "Doanh nhân",
    en: "Professional",
    subVi: "Headshot công sở — vest, ánh sáng studio",
    subEn: "Office headshot — suit, studio light",
    gradient: "linear-gradient(135deg, #2b3440, #5a6b7d)",
    scene:
      "Headshot doanh nhân chuyên nghiệp: vest tối màu vừa vặn, sơ mi trắng, nền văn phòng hiện đại hơi mờ (bokeh), ánh sáng studio mềm ba điểm, tư thế tự tin, nụ cười nhẹ chuyên nghiệp.",
    aspectRatio: "4:5",
  },
  {
    id: "aodai",
    thumb: "/packs/aodai.jpg",
    vi: "Áo dài Việt",
    en: "Áo dài",
    subVi: "Truyền thống, tông ấm, phông lụa",
    subEn: "Traditional Vietnamese, warm tones",
    gradient: "linear-gradient(135deg, #7d2a2a, #c9873b)",
    scene:
      "Chân dung trong tà áo dài truyền thống Việt Nam thanh lịch, phông nền lụa tông ấm hoặc hoa sen mờ nhẹ, ánh sáng vàng dịu, không khí trang nhã cổ điển.",
    aspectRatio: "3:4",
  },
  {
    id: "bold",
    thumb: "/packs/bold.jpg",
    vi: "Màu rực",
    en: "Bold colors",
    subVi: "Áo thun màu nổi trên nền phẳng tương phản",
    subEn: "Bright tee on a flat contrasting wall",
    gradient: "linear-gradient(135deg, #7b2ff7, #29b6f6)",
    scene:
      "Chân dung pop hiện đại: áo thun trơn màu rực rỡ (tím, cam hoặc vàng), nền phẳng một màu tương phản mạnh, ánh sáng phẳng đều kiểu quảng cáo, tươi tắn năng động.",
    aspectRatio: "4:5",
  },
  {
    id: "glamour",
    thumb: "/packs/glamour.jpg",
    vi: "Glamour",
    en: "Glamour",
    subVi: "Ánh sáng điện ảnh, sang trọng",
    subEn: "Cinematic, editorial lighting",
    gradient: "linear-gradient(135deg, #1a1a2e, #4a3b6b)",
    scene:
      "Chân dung glamour tạp chí: trang phục dạ hội thanh lịch kín đáo, nền tối sâu, ánh sáng điện ảnh một nguồn tạo khối rõ trên gương mặt, không khí sang trọng bí ẩn.",
    aspectRatio: "4:5",
  },
  {
    id: "film",
    thumb: "/packs/film.jpg",
    vi: "Retro film",
    en: "Retro film",
    subVi: "Màu phim 90s, hạt film nhẹ",
    subEn: "90s film look, light grain",
    gradient: "linear-gradient(135deg, #6b5b3e, #a58d5f)",
    scene:
      "Chân dung phong cách máy phim thập niên 90: màu film ấm hơi ngả vàng, hạt film mịn, trang phục casual retro (sơ mi kẻ hoặc áo len), bối cảnh đường phố hoặc quán cũ, hoài niệm.",
    aspectRatio: "3:4",
  },
  {
    id: "cafe",
    thumb: "/packs/cafe.jpg",
    vi: "Quán cà phê",
    en: "Café candid",
    subVi: "Tự nhiên, ấm áp — hợp ảnh hẹn hò/profile",
    subEn: "Natural and warm — great for dating profiles",
    gradient: "linear-gradient(135deg, #4e342e, #8d6e63)",
    scene:
      "Chân dung đời thường trong quán cà phê ấm cúng: áo len hoặc sơ mi casual, cầm tách cà phê, ánh sáng cửa sổ tự nhiên, hậu cảnh quán mờ nhẹ, nụ cười thân thiện thoải mái.",
    aspectRatio: "4:5",
  },
  {
    id: "bw",
    thumb: "/packs/bw.jpg",
    vi: "Đen trắng",
    en: "Black & white",
    subVi: "Đơn sắc nghệ thuật, tương phản sâu",
    subEn: "Artistic monochrome, deep contrast",
    gradient: "linear-gradient(135deg, #111111, #6e6e6e)",
    scene:
      "Chân dung đen trắng nghệ thuật: đơn sắc hoàn toàn, tương phản sâu, ánh sáng tạo khối mạnh một bên mặt, nền tối trơn, chi tiết da và ánh mắt sắc nét, phong cách fine-art.",
    aspectRatio: "4:5",
  },
  {
    id: "cotrang",
    thumb: "/packs/cotrang.jpg",
    vi: "Cổ trang",
    en: "Historical",
    subVi: "Trang phục cổ Việt, không khí phim trường",
    subEn: "Vietnamese period costume, cinematic set",
    gradient: "linear-gradient(135deg, #3e2723, #7f5539)",
    scene:
      "Chân dung cổ trang Việt Nam: trang phục cung đình hoặc nhật bình cổ điển, phụ kiện tóc truyền thống, bối cảnh cung điện hoặc sân gạch cổ mờ nhẹ, ánh sáng ấm kiểu phim trường lịch sử.",
    aspectRatio: "3:4",
  },
];

export function getPack(id: string): StylePack | undefined {
  return PACKS.find((p) => p.id === id);
}

/**
 * Sàn danh tính — đi vào MỌI prompt của mọi pack.
 *
 * Luồng sáng tạo mở hết mọi thứ trừ một điều: ảnh phải vẫn là NGƯỜI ĐÓ. Đây là
 * điều dễ mất nhất khi viết prompt cho từng pack, nên nó nằm một chỗ duy nhất và
 * có test canh từng dòng.
 */
const IDENTITY_FLOOR = [
  "GIỮ NGUYÊN khuôn mặt và đặc điểm nhận dạng của người trong ảnh: đường nét, tỉ lệ mặt, màu mắt, nốt ruồi, sẹo. Ảnh phải nhận ra ngay là chính người đó.",
  "KHÔNG đổi độ tuổi, giới tính, màu da hay vóc dáng.",
  "Chỉ MỘT người duy nhất trong ảnh.",
  "Trang phục kín đáo lịch sự, không nội dung phản cảm.",
  "Ảnh phong cách nhiếp ảnh chân thực, không phải tranh vẽ hay hoạt hình.",
] as const;

/**
 * Gợi ý biến thể theo chỉ số — cùng một pack gọi nhiều lần phải ra ảnh KHÁC nhau,
 * không phải cùng một ảnh lặp lại.
 */
const VARIANT_HINTS = [
  "Góc chụp chính diện, nhìn thẳng ống kính.",
  "Góc máy hơi chếch nhẹ, ánh mắt vẫn hướng về ống kính.",
  "Khung rộng hơn một chút, thấy rõ vai và một phần thân trên.",
  "Ánh sáng ấm hơn một chút, biểu cảm tươi hơn.",
] as const;

/** Ghi chú tự do của người dùng bị cắt ở đây — cả client lẫn server cùng cắt */
export const MAX_NOTE_LENGTH = 300;

/**
 * @param note ghi chú tự do của người dùng ("tóc búi cao, tông ấm…"). Chèn TRƯỚC
 *        khối ràng buộc — sàn danh tính đứng sau nên luôn thắng nếu ghi chú mâu thuẫn.
 */
export function buildPackPrompt(pack: StylePack, variant = 0, note = ""): string {
  const hint = VARIANT_HINTS[variant % VARIANT_HINTS.length];
  const wish = note.trim().slice(0, MAX_NOTE_LENGTH);
  return `Biến ảnh chân dung được cung cấp thành một bức ảnh mới theo phong cách sau:

${pack.scene}

${hint}
${wish ? `\nYêu cầu thêm từ người dùng: ${wish}\n` : ""}
RÀNG BUỘC BẮT BUỘC:
${IDENTITY_FLOOR.map((l) => `- ${l}`).join("\n")}

Trả về ảnh đã tạo.`;
}

/**
 * Prompt cho vòng LẶP trên một ảnh ĐÃ sinh: tinh chỉnh theo ghi chú, hoặc vẽ lại
 * ở độ phân giải cao. Đây là chỗ biến "up mặt phát ra 2 ảnh" thành vòng chỉnh
 * tới khi ưng — ảnh nào cũng tinh chỉnh tiếp được, và sàn danh tính vẫn đứng cuối.
 */
export function buildRefinePrompt(note = "", upscale = false): string {
  const wish = note.trim().slice(0, MAX_NOTE_LENGTH);
  const jobs: string[] = [];
  if (wish) jobs.push(`Chỉnh lại theo yêu cầu: ${wish}`);
  if (upscale)
    jobs.push(
      "Vẽ lại ở độ phân giải và độ nét cao nhất. GIỮ NGUYÊN bố cục, trang phục, bối cảnh, tư thế và biểu cảm — chỉ tăng chất lượng, không đổi nội dung."
    );
  if (jobs.length === 0)
    jobs.push("Vẽ lại đẹp hơn: ánh sáng và chi tiết tinh hơn, giữ nguyên nội dung.");

  return `Đây là ảnh chân dung đã tạo trước đó. Sửa lại bức ảnh này:

${jobs.map((j, i) => `${i + 1}. ${j}`).join("\n")}

RÀNG BUỘC BẮT BUỘC:
${IDENTITY_FLOOR.map((l) => `- ${l}`).join("\n")}

Trả về ảnh đã sửa.`;
}
