import { describe, expect, it } from "vitest";
import {
  INITIAL,
  exportBlock,
  pendingGroups,
  variantKey,
  workingFor,
  type StudioState,
} from "./studio";
import type { PhotoCheck } from "./checks";
import type { Working } from "./studio";

const check: PhotoCheck = {
  landmarks: { crownY: 0.12, chinY: 0.47, eyeMidY: 0.22, faceCenterX: 0.5 },
  imageWidth: 2000,
  imageHeight: 2667,
  checks: [],
};

const shot: Working = {
  photo: "data:image/jpeg;base64,x",
  landmarks: check.landmarks,
  width: 2000,
  height: 2667,
};

function state(over: Partial<StudioState> = {}): StudioState {
  return { ...INITIAL, photo: "data:image/jpeg;base64,x", check, ...over };
}

/**
 * Chốt cuối của lời hứa cốt lõi. Không có nó thì luồng vẫn cho đi thẳng
 * Kiểm tra → Chỉnh sửa → Xuất ảnh và giao file cắt từ ảnh GỐC nền phòng khách —
 * đúng thứ màn Kiểm tra vừa hứa là "app sửa tự động ở bước sau".
 *
 * Dựng lại bug theo CẢ HAI CHIỀU: chưa chuẩn hoá thì phải chặn, chuẩn hoá xong
 * thì phải cho qua. Chỉ canh một chiều thì một hàm luôn trả "chặn" cũng xanh.
 */
describe("exportBlock", () => {
  it("chưa chụp thì chặn", () => {
    expect(exportBlock({ ...INITIAL })).toBe("pending-background");
  });

  it("chụp rồi nhưng CHƯA chuẩn hoá thì chặn — đây là lỗ đã từng hở", () => {
    expect(exportBlock(state())).toBe("pending-background");
  });

  it("chuẩn hoá xong và nền đo ra ĐÚNG thì cho qua", () => {
    const base = state();
    const s = state({
      retouched: { [variantKey(base, "white")]: { ...shot, backgroundOk: true } },
    });
    expect(exportBlock(s)).toBeNull();
  });

  it("chuẩn hoá rồi nhưng nền đo ra SAI thì vẫn chặn", () => {
    const base = state();
    const s = state({
      retouched: { [variantKey(base, "white")]: { ...shot, backgroundOk: false } },
    });
    expect(exportBlock(s)).toBe("failed-background");
  });

  it("thêm loại đòi nền khác mà chưa chuẩn hoá nhóm đó thì chặn lại", () => {
    // vn34 cho phép nền xanh; chọn xanh thì sinh nhóm nền thứ hai chưa xử lý.
    const base = state();
    const s = state({
      primary: "vn34",
      picked: ["vn34"],
      bgPref: "blue",
      retouched: { [variantKey(base, "white")]: { ...shot, backgroundOk: true } },
    });
    expect(exportBlock(s)).toBe("pending-background");
  });
});

/**
 * Mô hình VERSION: mỗi bộ tuỳ chọn AI là một bản ảnh riêng trong cache. Đổi
 * toggle không xoá gì — chỉ đổi ngăn đang nhìn vào. Model không tất định nên
 * "giữ được bản đã ưng" là hành vi phải đóng băng, không phải chi tiết cài đặt.
 */
describe("cache version theo tuỳ chọn", () => {
  const smoothOn = state({ smooth: true });
  const smoothOff = state({ smooth: false });
  const keyOn = variantKey(smoothOn, "white");
  const keyOff = variantKey(smoothOff, "white");

  it("hai bộ tuỳ chọn ra hai key khác nhau, cùng nền", () => {
    expect(keyOn).not.toBe(keyOff);
  });

  it("tắt mịn da khi CHỈ có bản mịn: HIỂN THỊ giữ bản anh em, CAM KẾT vẫn chặn", () => {
    /**
     * Hai tầng phải tách nhau: preview rơi về ảnh gốc nền phòng khách đọc ra là
     * "mất trắng công chuẩn hoá" (phản hồi thật từ người dùng) — nên hiển thị
     * lấy bản gần nhất. Nhưng xuất file thì KHÔNG: bản đang hiện không đúng
     * tuỳ chọn đã chọn, giao nó đi là nói dối bằng file.
     */
    const cached = { [keyOn]: { ...shot, backgroundOk: true } };
    const off = state({ smooth: false, retouched: cached });
    expect(pendingGroups(off).length).toBe(1);
    expect(workingFor(off, "vn34")?.backgroundOk).toBe(true); // = bản anh em
    expect(exportBlock(off)).toBe("pending-background"); // cam kết: vẫn chặn
  });

  it("bật lại: lấy ĐÚNG bản cũ từ cache, không cần chạy gì", () => {
    const cached = { [keyOn]: { ...shot, backgroundOk: true } };
    const on = state({ smooth: true, retouched: cached });
    expect(pendingGroups(on).length).toBe(0);
    expect(workingFor(on, "vn34")?.backgroundOk).toBe(true);
    expect(exportBlock(on)).toBeNull();
  });

  it("cả hai version cùng sống trong cache — không version nào đè version nào", () => {
    const both = state({
      retouched: {
        [keyOn]: { ...shot, backgroundOk: true },
        [keyOff]: { ...shot, backgroundOk: false },
      },
    });
    // đang bật mịn → nhìn ngăn mịn (ok); tắt → nhìn ngăn kia (sai nền, phải chặn)
    expect(exportBlock({ ...both, smooth: true })).toBeNull();
    expect(exportBlock({ ...both, smooth: false })).toBe("failed-background");
  });
});
