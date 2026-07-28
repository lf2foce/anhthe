import { describe, expect, it } from "vitest";
import { INITIAL, exportBlock, type StudioState } from "./studio";
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
    const s = state({ retouched: { white: { ...shot, backgroundOk: true } } });
    expect(exportBlock(s)).toBeNull();
  });

  it("chuẩn hoá rồi nhưng nền đo ra SAI thì vẫn chặn", () => {
    const s = state({ retouched: { white: { ...shot, backgroundOk: false } } });
    expect(exportBlock(s)).toBe("failed-background");
  });

  it("thêm loại đòi nền khác mà chưa chuẩn hoá nhóm đó thì chặn lại", () => {
    // vn34 cho phép nền xanh; chọn xanh thì sinh nhóm nền thứ hai chưa xử lý.
    const s = state({
      primary: "vn34",
      picked: ["vn34"],
      bgPref: "blue",
      retouched: { white: { ...shot, backgroundOk: true } },
    });
    expect(exportBlock(s)).toBe("pending-background");
  });
});
