/**
 * Test cho SÀN của Studio sáng tạo.
 *
 * Luồng này cố ý mở hết — trang phục, bối cảnh, ánh sáng đều được vẽ lại — nên thứ
 * duy nhất đáng test không phải "prompt có đẹp không" mà là: sàn danh tính có mặt
 * trong MỌI prompt, và các pack thật sự khác nhau. Không gọi mạng.
 */

import { describe, expect, it, vi } from "vitest";
import {
  MAX_NOTE_LENGTH,
  PACKS,
  buildPackPrompt,
  buildRefinePrompt,
  getPack,
  ratioLabel,
} from "./packs";

describe("registry pack", () => {
  it("có ít nhất 6 phong cách và id không trùng", () => {
    expect(PACKS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(PACKS.length);
  });

  it("mọi pack dùng tỉ lệ khung model hỗ trợ", () => {
    for (const p of PACKS) {
      expect(["1:1", "3:4", "4:5"]).toContain(p.aspectRatio);
    }
  });

  it("getPack trả undefined cho id lạ thay vì nổ", () => {
    expect(getPack("khong-ton-tai")).toBeUndefined();
  });
});

/**
 * Từng dòng sàn, canh theo cụm chữ cốt lõi. Viết lại prompt kiểu gì cũng được,
 * nhưng rơi một dòng trong này là ảnh của khách có thể thành người khác.
 */
const FLOOR_MARKS = [
  "GIỮ NGUYÊN khuôn mặt",
  "KHÔNG đổi độ tuổi",
  "MỘT người duy nhất",
  "kín đáo",
  "không phải tranh vẽ",
];

describe("buildPackPrompt — sàn danh tính", () => {

  it("mọi pack, mọi biến thể đều chứa đủ sàn danh tính", () => {
    for (const p of PACKS) {
      for (const variant of [0, 1, 2, 3]) {
        const prompt = buildPackPrompt(p, variant);
        for (const mark of FLOOR_MARKS) {
          expect(prompt, `pack ${p.id} thiếu "${mark}"`).toContain(mark);
        }
      }
    }
  });

  it("mỗi pack cho một prompt khác nhau — không phải một prompt chung", () => {
    const prompts = PACKS.map((p) => buildPackPrompt(p));
    expect(new Set(prompts).size).toBe(PACKS.length);
  });

  it("các biến thể của cùng một pack khác nhau — gọi 2 lần không được ra 2 ảnh y hệt", () => {
    const p = PACKS[0];
    expect(buildPackPrompt(p, 0)).not.toEqual(buildPackPrompt(p, 1));
  });

  it("biến thể vượt danh sách gợi ý thì quay vòng, không nổ", () => {
    const p = PACKS[0];
    expect(buildPackPrompt(p, 4)).toEqual(buildPackPrompt(p, 0));
  });

  it("ghi chú người dùng vào prompt, nhưng SÀN vẫn đứng SAU ghi chú", () => {
    const prompt = buildPackPrompt(PACKS[0], 0, "tóc búi cao, tông ấm");
    expect(prompt).toContain("tóc búi cao, tông ấm");
    // Sàn đứng sau để thắng khi ghi chú mâu thuẫn — thứ tự là một phần hợp đồng.
    expect(prompt.indexOf("tóc búi cao")).toBeLessThan(
      prompt.indexOf("GIỮ NGUYÊN khuôn mặt")
    );
    for (const mark of FLOOR_MARKS) expect(prompt).toContain(mark);
  });

  it("ghi chú dài bị cắt ở MAX_NOTE_LENGTH — không phồng prompt vô hạn", () => {
    const long = "x".repeat(MAX_NOTE_LENGTH * 3);
    const prompt = buildPackPrompt(PACKS[0], 0, long);
    expect(prompt).toContain("x".repeat(MAX_NOTE_LENGTH));
    expect(prompt).not.toContain("x".repeat(MAX_NOTE_LENGTH + 1));
  });
});

describe("buildRefinePrompt — vòng lặp trên ảnh đã sinh", () => {
  it("cả ba đường (ghi chú / nâng 2K / mặc định) đều giữ đủ sàn danh tính", () => {
    for (const prompt of [
      buildRefinePrompt("nền tối hơn"),
      buildRefinePrompt("", true),
      buildRefinePrompt(),
    ]) {
      for (const mark of FLOOR_MARKS) expect(prompt).toContain(mark);
    }
  });

  it("ghi chú xuất hiện; nâng 2K nói rõ GIỮ NGUYÊN nội dung", () => {
    expect(buildRefinePrompt("nền tối hơn")).toContain("nền tối hơn");
    const up = buildRefinePrompt("", true);
    expect(up).toContain("GIỮ NGUYÊN bố cục");
    expect(up).toContain("độ phân giải");
  });
});

describe("ratioLabel — nhãn tỉ lệ đọc từ kích thước THẬT của ảnh", () => {
  /**
   * Nhãn phải suy từ ảnh, không từ tuỳ chọn đang bật: tuỳ chọn áp cho lô SAU,
   * còn ảnh đang xem có thể thuộc lô cũ tỉ lệ khác — và model có quyền trả lệch
   * vài pixel so với tỉ lệ đặt hàng.
   */
  it("khớp các tỉ lệ quen thuộc, kể cả lệch vài pixel do model", () => {
    expect(ratioLabel(1024, 1024)).toBe("1:1");
    expect(ratioLabel(1080, 1350)).toBe("4:5");
    expect(ratioLabel(768, 1024)).toBe("3:4");
    expect(ratioLabel(1080, 1920)).toBe("9:16");
    // lệch ~1% — vẫn phải đọc ra 4:5 chứ không rơi về số thô
    expect(ratioLabel(1080, 1340)).toBe("4:5");
  });

  it("tỉ lệ lạ thì trả số thô, không ép vào nhãn sai", () => {
    // 1000×1234 KHÔNG dùng làm ca "lạ" được: 0.810 lệch 1.3% khỏi 4:5, nằm
    // trong dung sai 3% và PHẢI đọc ra 4:5 — đó là mục đích của dung sai.
    expect(ratioLabel(1000, 1234)).toBe("4:5");
    // 0.714 lệch ~5% khỏi 3:4 và xa mọi nhãn khác — mới thật sự là lạ.
    expect(ratioLabel(1000, 1400)).toBe("1000:1400");
  });
});

describe("SITE_URL — env để trống không được làm gãy build", () => {
  /**
   * `NEXT_PUBLIC_SITE_URL=` (rỗng) là chuyện rất thường khi dựng file env, và
   * `??` không chặn chuỗi rỗng. Khi đó `new URL("")` ném lỗi ở tầng metadata và
   * build chết với một câu chẳng liên quan gì: "Failed to collect configuration
   * for /_not-found". Đã dính đúng ca này.
   */
  async function load(env: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v ?? "");
    vi.resetModules();
    return (await import("./landing")).SITE_URL;
  }

  it("để trống thì rơi về localhost, KHÔNG ném lỗi", async () => {
    const url = await load({
      NEXT_PUBLIC_SITE_URL: "",
      VERCEL_PROJECT_PRODUCTION_URL: "",
    });
    expect(() => new URL(url)).not.toThrow();
    expect(url).toBe("http://localhost:3000");
  });

  it("chỉ khoảng trắng cũng coi như trống", async () => {
    const url = await load({
      NEXT_PUBLIC_SITE_URL: "   ",
      VERCEL_PROJECT_PRODUCTION_URL: "",
    });
    expect(url).toBe("http://localhost:3000");
  });

  it("có domain Vercel thì dùng nó khi không khai tường minh", async () => {
    expect(
      await load({
        NEXT_PUBLIC_SITE_URL: "",
        VERCEL_PROJECT_PRODUCTION_URL: "anhthe.vn",
      })
    ).toBe("https://anhthe.vn");
  });

  it("cắt dấu / thừa ở cuối — nếu không thì mọi URL sinh ra có hai gạch", async () => {
    expect(
      await load({ NEXT_PUBLIC_SITE_URL: "https://anhthe.vn/" })
    ).toBe("https://anhthe.vn");
  });
});
