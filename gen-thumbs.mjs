/**
 * Sinh ảnh mẫu cho gallery Studio sáng tạo — chạy MỘT LẦN, kết quả commit vào
 * public/packs/. Người mẫu là nhân vật HƯ CẤU do AI tạo (không phải người thật),
 * sau đó chạy qua đúng scene của từng pack để mọi tile cùng một người.
 *
 * Scene ở đây chép từ src/lib/packs.ts tại thời điểm chạy — nếu đổi scene thì
 * chạy lại script này để tile khớp sản phẩm.
 */
import fs from "node:fs";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const key = /GEMINI_API_KEY=(.+)/.exec(fs.readFileSync(".env.local", "utf8"))[1].trim();
const ai = new GoogleGenAI({ apiKey: key });
const MODEL = "gemini-3.1-flash-image";

async function gen(parts, aspect = "3:4") {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: { imageConfig: { aspectRatio: aspect } },
  });
  const ps = res.candidates?.[0]?.content?.parts ?? [];
  for (const p of ps) if (p.inlineData?.data) return Buffer.from(p.inlineData.data, "base64");
  throw new Error("no image: " + (ps.find((p) => p.text)?.text ?? "?").slice(0, 200));
}

const SCENES = {
  pro: "Headshot doanh nhân chuyên nghiệp: vest tối màu vừa vặn, sơ mi trắng, nền văn phòng hiện đại hơi mờ (bokeh), ánh sáng studio mềm ba điểm, tư thế tự tin, nụ cười nhẹ chuyên nghiệp.",
  aodai: "Chân dung trong tà áo dài truyền thống Việt Nam thanh lịch, phông nền lụa tông ấm hoặc hoa sen mờ nhẹ, ánh sáng vàng dịu, không khí trang nhã cổ điển.",
  bold: "Chân dung pop hiện đại: áo thun trơn màu rực rỡ (tím, cam hoặc vàng), nền phẳng một màu tương phản mạnh, ánh sáng phẳng đều kiểu quảng cáo, tươi tắn năng động.",
  glamour: "Chân dung glamour tạp chí: trang phục dạ hội thanh lịch kín đáo, nền tối sâu, ánh sáng điện ảnh một nguồn tạo khối rõ trên gương mặt, không khí sang trọng bí ẩn.",
  film: "Chân dung phong cách máy phim thập niên 90: màu film ấm hơi ngả vàng, hạt film mịn, trang phục casual retro (sơ mi kẻ hoặc áo len), bối cảnh đường phố hoặc quán cũ, hoài niệm.",
  cafe: "Chân dung đời thường trong quán cà phê ấm cúng: áo len hoặc sơ mi casual, cầm tách cà phê, ánh sáng cửa sổ tự nhiên, hậu cảnh quán mờ nhẹ, nụ cười thân thiện thoải mái.",
  bw: "Chân dung đen trắng nghệ thuật: đơn sắc hoàn toàn, tương phản sâu, ánh sáng tạo khối mạnh một bên mặt, nền tối trơn, chi tiết da và ánh mắt sắc nét, phong cách fine-art.",
  cotrang: "Chân dung cổ trang Việt Nam: trang phục cung đình hoặc nhật bình cổ điển, phụ kiện tóc truyền thống, bối cảnh cung điện hoặc sân gạch cổ mờ nhẹ, ánh sáng ấm kiểu phim trường lịch sử.",
};

fs.mkdirSync("public/packs", { recursive: true });

// 1. Người mẫu hư cấu — KHÔNG phải người thật nào.
//
// Tái dùng `_base.jpg` đã có: sinh base mới mỗi lần chạy thì chạy lại script là
// 8 tile ra một người KHÁC, gallery mất tính nhất quán. Muốn đổi người mẫu thì
// xoá file này rồi chạy lại.
const BASE_PATH = "public/packs/_base.jpg";
let base;
if (fs.existsSync(BASE_PATH)) {
  console.log("base (dùng lại file đã có)");
  base = fs.readFileSync(BASE_PATH);
} else {
  console.log("base (tạo mới)...");
  base = await gen([
    {
      text: "Tạo ảnh chân dung studio chân thực của một phụ nữ Việt Nam hư cấu ngoài 20 tuổi (nhân vật do AI tạo, không phải người thật), tóc đen dài, biểu cảm thân thiện, áo thun trơn màu be, nền xám nhạt trơn, ánh sáng mềm. Ảnh phong cách nhiếp ảnh, nhìn thẳng ống kính, thấy rõ vai.",
    },
  ]);
  await sharp(base).jpeg({ quality: 85 }).toFile(BASE_PATH);
}

// 2. Chạy người mẫu qua từng pack.
for (const [id, scene] of Object.entries(SCENES)) {
  console.log(id + "...");
  try {
    const out = await gen([
      { inlineData: { mimeType: "image/jpeg", data: base.toString("base64") } },
      {
        text: `Biến ảnh chân dung được cung cấp thành: ${scene}\n\nGIỮ NGUYÊN khuôn mặt của người trong ảnh. Chỉ MỘT người. Trang phục kín đáo. Ảnh phong cách nhiếp ảnh chân thực.`,
      },
    ]);
    await sharp(out).resize(480, 640, { fit: "cover" }).jpeg({ quality: 72 }).toFile(`public/packs/${id}.jpg`);
  } catch (e) {
    console.error(`  ${id} FAILED: ${e.message.slice(0, 160)}`);
  }
}
console.log("done");
