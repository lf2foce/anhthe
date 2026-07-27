import { describe, expect, it } from "vitest";
import {
  BACKGROUNDS,
  DOCS,
  DOC_FAMILIES,
  allowedBackgrounds,
  docsOf,
  familiesOf,
  familyOf,
  getDoc,
  groupByBackground,
  outputSize,
  resolveBackground,
  type BackgroundId,
} from "./docs";
import { computeCrop } from "./geometry";

const BG_IDS = BACKGROUNDS.map((b) => b.id) as BackgroundId[];

describe("registry invariants", () => {
  it("mọi spec có dải headRatio hợp lệ và target nằm trong dải", () => {
    for (const s of DOCS) {
      expect(s.headRatio.min).toBeLessThan(s.headRatio.max);
      expect(s.headRatio.target).toBeGreaterThanOrEqual(s.headRatio.min);
      expect(s.headRatio.target).toBeLessThanOrEqual(s.headRatio.max);
      expect(s.eyeFromBottom.min).toBeLessThan(s.eyeFromBottom.max);
      expect(s.eyeFromBottom.target).toBeGreaterThanOrEqual(s.eyeFromBottom.min);
      expect(s.eyeFromBottom.target).toBeLessThanOrEqual(s.eyeFromBottom.max);
    }
  });

  /**
   * renderSingle resize bằng `fit: "fill"`, còn khung crop tính theo tỉ lệ mm
   * (`cropW = cropH * widthMm / heightMm`). Nếu tỉ lệ PIXEL đích lệch khỏi tỉ lệ mm
   * thì mặt bị KÉO MÉO mà không có gì báo.
   *
   * Ngưỡng suy ra từ phép làm tròn, không phải số chọn bừa: `mmToPx` làm tròn nên
   * mỗi cạnh lệch tối đa 0.5px, kéo tỉ lệ lệch cỡ 1/chiều-cao. Đòi khớp tới 3 chữ số
   * thập phân là đòi điều bất khả với px nguyên — 40×50mm ra 472×591px, tỉ lệ 0.7986
   * chứ không phải 0.8 chẵn.
   */
  it("tỉ lệ pixel đích phải khớp tỉ lệ mm — nếu không mặt bị kéo méo", () => {
    for (const s of DOCS) {
      const cropAspect = s.widthMm / s.heightMm;
      for (const variant of ["print", "digital"] as const) {
        if (variant === "digital" && !s.digital) continue;
        const target = outputSize(s, variant);
        const slack = 2 / target.height;
        expect(Math.abs(target.width / target.height - cropAspect)).toBeLessThan(
          slack
        );
      }
    }
  });

  it("ngưỡng trên vẫn bắt được lệch tỉ lệ THẬT, không chỉ là làm tròn", () => {
    // 3×4cm mà gắn bản digital vuông là kéo méo mặt rõ rệt — phải vượt ngưỡng.
    const bad = { widthMm: 30, heightMm: 40, digital: { width: 600, height: 600 } };
    const cropAspect = bad.widthMm / bad.heightMm;
    const slack = 2 / bad.digital.height;
    expect(
      Math.abs(bad.digital.width / bad.digital.height - cropAspect)
    ).toBeGreaterThan(slack);
  });

  it("mọi spec khai ít nhất một nền, và chỉ dùng nền trong danh mục", () => {
    for (const s of DOCS) {
      expect(s.backgrounds.length).toBeGreaterThan(0);
      for (const bg of s.backgrounds) expect(BG_IDS).toContain(bg);
    }
  });

  it("mọi spec phải khai nguồn — không có số nào vào đây mà không truy được", () => {
    for (const s of DOCS) {
      expect(s.source.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("resolveBackground", () => {
  it("tôn trọng lựa chọn người dùng khi spec cho phép", () => {
    expect(resolveBackground(getDoc("vn34")!, "blue")).toBe("blue");
  });

  it("BỎ QUA lựa chọn người dùng khi spec không cho phép", () => {
    // Visa Mỹ nền xanh là bị trả ở quầy — không có đường nào chọn được.
    expect(resolveBackground(getDoc("us")!, "blue")).toBe("white");
    expect(resolveBackground(getDoc("schen")!, "grey")).toBe("white");
  });

  it("không lựa chọn thì lấy nền mặc định của spec", () => {
    expect(resolveBackground(getDoc("link")!, null)).toBe("grey");
    expect(resolveBackground(getDoc("us")!, null)).toBe("white");
  });

  it("không bao giờ trả về nền spec không cho phép, với mọi lựa chọn", () => {
    for (const spec of DOCS) {
      for (const pref of [...BG_IDS, null]) {
        expect(spec.backgrounds).toContain(resolveBackground(spec, pref));
      }
    }
  });
});

describe("groupByBackground", () => {
  it("giấy tờ tuỳ thân gộp về một nhóm nền trắng — một lần gọi model", () => {
    const groups = groupByBackground(["us", "schen", "vn34", "exam"], null);
    expect(groups).toHaveLength(1);
    expect(groups[0].background).toBe("white");
    expect(groups[0].docIds).toEqual(["us", "schen", "vn34", "exam"]);
  });

  it("thêm LinkedIn là thành hai nhóm, vì nền khác nhau", () => {
    const groups = groupByBackground(["us", "link"], null);
    expect(groups.map((g) => g.background)).toEqual(["white", "grey"]);
    expect(groups.find((g) => g.background === "grey")?.docIds).toEqual(["link"]);
  });

  it("chọn nền xanh chỉ tách những loại CHO PHÉP xanh", () => {
    const groups = groupByBackground(["us", "vn34", "vn46", "exam"], "blue");
    const byBg = Object.fromEntries(groups.map((g) => [g.background, g.docIds]));
    expect(byBg.blue).toEqual(["vn34", "vn46"]);
    expect(byBg.white).toEqual(["us", "exam"]);
  });

  it("mỗi loại giấy tờ thuộc đúng một nhóm, không lặp", () => {
    for (const pref of [...BG_IDS, null]) {
      const ids = DOCS.map((d) => d.id);
      const flat = groupByBackground(ids, pref).flatMap((g) => g.docIds);
      expect(flat.slice().sort()).toEqual(ids.slice().sort());
    }
  });

  it("thứ tự nhóm không phụ thuộc thứ tự người dùng bấm chọn", () => {
    const a = groupByBackground(["link", "us"], null).map((g) => g.background);
    const b = groupByBackground(["us", "link"], null).map((g) => g.background);
    expect(a).toEqual(b);
  });

  it("bỏ qua id không có trong registry", () => {
    expect(groupByBackground(["us", "khong-ton-tai"], null)[0].docIds).toEqual(["us"]);
  });
});

describe("allowedBackgrounds", () => {
  it("chỉ mở nền mà ít nhất một loại đang chọn cho phép", () => {
    expect(allowedBackgrounds(["us"])).toEqual(["white"]);
    expect(allowedBackgrounds(["us", "vn34"])).toEqual(["white", "blue"]);
    expect(allowedBackgrounds(["link"])).toEqual(["white", "grey"]);
  });
});

describe("familiesOf", () => {
  it("phân biệt giấy tờ tuỳ thân với ảnh chân dung", () => {
    expect(familiesOf(["us", "vn34"])).toEqual(["id"]);
    expect(familiesOf(["link"])).toEqual(["portrait"]);
    expect(familiesOf(["us", "link"]).slice().sort()).toEqual(["id", "portrait"]);
  });
});

describe("chế độ = họ giấy tờ", () => {
  it("mỗi họ có ít nhất một loại — chế độ rỗng là chế độ chết", () => {
    for (const f of DOC_FAMILIES) {
      expect(docsOf(f.id).length).toBeGreaterThan(0);
    }
  });

  it("hai chế độ phủ hết registry và không chồng nhau", () => {
    const byFamily = DOC_FAMILIES.flatMap((f) => docsOf(f.id).map((d) => d.id));
    expect(byFamily.slice().sort()).toEqual(DOCS.map((d) => d.id).sort());
    expect(new Set(byFamily).size).toBe(byFamily.length);
  });

  it("familyOf khớp với danh sách của chế độ đó", () => {
    for (const f of DOC_FAMILIES) {
      for (const d of docsOf(f.id)) expect(familyOf(d.id)).toBe(f.id);
    }
  });

  it("id không có trong registry rơi về chế độ giấy tờ, không phải chân dung", () => {
    // Rơi về chế độ CHẶT hơn: đoán sai theo hướng an toàn.
    expect(familyOf("khong-ton-tai")).toBe("id");
  });
});

describe("hình học nhiều spec trên CÙNG một ảnh nguồn", () => {
  // Ảnh chân dung 2000×2667, đầu chiếm 35% chiều cao.
  const lm = { crownY: 0.12, chinY: 0.47, eyeMidY: 0.22, faceCenterX: 0.5 };

  /**
   * Quyết định thiết kế: cho chọn nhiều loại giấy tờ CÙNG LÚC là đúng, vì mỗi spec
   * tự cắt khung riêng từ cùng một ảnh. Tỉ lệ đầu khác nhau (visa Mỹ 60% vs
   * Schengen 75%) KHÔNG xung đột — cái xung đột là nền, và nền được xử lý bằng
   * cách nhóm ở trên.
   */
  it("visa Mỹ 60% và Schengen 75% cùng đạt target từ một ảnh", () => {
    for (const id of ["us", "schen"]) {
      const spec = getDoc(id)!;
      const r = computeCrop(lm, 2000, 2667, spec);
      expect(r.errors).toEqual([]);
      expect(r.headRatio).toBeCloseTo(spec.headRatio.target, 2);
      expect(r.eyeFromBottom).toBeCloseTo(spec.eyeFromBottom.target, 2);
    }
  });

  it("mọi spec trong registry đạt chuẩn từ cùng ảnh đó", () => {
    for (const spec of DOCS) {
      const r = computeCrop(lm, 2000, 2667, spec);
      expect(r.errors).toEqual([]);
      expect(r.headRatio).toBeGreaterThanOrEqual(spec.headRatio.min);
      expect(r.headRatio).toBeLessThanOrEqual(spec.headRatio.max);
    }
  });
});
