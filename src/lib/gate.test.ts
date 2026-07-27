import { beforeEach, describe, expect, it } from "vitest";
import {
  FREE_CALLS_PER_DAY,
  GLOBAL_CALLS_PER_DAY,
  MAX_BODY_BYTES,
  __resetGate,
  checkGate,
  isGateFailure,
  remainingFor,
} from "./gate";

function req(opts: { bytes?: number; aid?: string } = {}): Request {
  const headers = new Headers();
  if (opts.bytes) headers.set("content-length", String(opts.bytes));
  if (opts.aid) headers.set("cookie", `aid=${opts.aid}`);
  return new Request("http://localhost/api/generate", { method: "POST", headers });
}

beforeEach(() => __resetGate());

describe("trần dung lượng", () => {
  it("chặn body vượt trần TRƯỚC khi giải mã", async () => {
    const r = await checkGate(req({ bytes: MAX_BODY_BYTES + 1 }), 1);
    expect(isGateFailure(r)).toBe(true);
  });

  it("cho qua body vừa đúng trần", async () => {
    expect(isGateFailure(await checkGate(req({ bytes: MAX_BODY_BYTES }), 1))).toBe(false);
  });

  it("thiếu content-length thì không chặn ở lớp này — còn hai lớp sau", async () => {
    expect(isGateFailure(await checkGate(req(), 1))).toBe(false);
  });
});

describe("hạn mức theo khách", () => {
  it("cho đúng FREE_CALLS_PER_DAY lượt rồi chặn", async () => {
    for (let i = 0; i < FREE_CALLS_PER_DAY; i++) {
      expect(isGateFailure(await checkGate(req({ aid: "khach10000000000000000" }), 1)), `lượt ${i + 1}`).toBe(
        false
      );
    }
    expect(isGateFailure(await checkGate(req({ aid: "khach10000000000000000" }), 1))).toBe(true);
  });

  it("khách khác không bị ảnh hưởng", async () => {
    for (let i = 0; i < FREE_CALLS_PER_DAY; i++) await checkGate(req({ aid: "khach10000000000000000" }), 1);
    expect(isGateFailure(await checkGate(req({ aid: "khach20000000000000000" }), 1))).toBe(false);
  });

  /**
   * Trừ TRƯỚC khi gọi model, không phải sau khi thành công. Trừ sau thì một loạt
   * request song song đều thấy bộ đếm còn nguyên và lọt hết — đúng kiểu tấn công
   * rẻ nhất.
   */
  it("một lượt tốn nhiều lần gọi bị trừ đủ ngay, không trừ dần", async () => {
    const r = await checkGate(req({ aid: "khach30000000000000000" }), 4);
    expect(isGateFailure(r)).toBe(false);
    if (!isGateFailure(r)) expect(r.remaining).toBe(FREE_CALLS_PER_DAY - 4);
    expect((await remainingFor(req({ aid: "khach30000000000000000" }))).remaining).toBe(FREE_CALLS_PER_DAY - 4);
  });

  it("lượt tốn nhiều hơn số còn lại thì bị chặn, không cho tiêu âm", async () => {
    await checkGate(req({ aid: "khach40000000000000000" }), FREE_CALLS_PER_DAY - 1);
    expect(isGateFailure(await checkGate(req({ aid: "khach40000000000000000" }), 4))).toBe(true);
    expect((await remainingFor(req({ aid: "khach40000000000000000" }))).remaining).toBe(1);
  });
});

describe("trần chi toàn cục", () => {
  /**
   * Đây là chốt cứng THẬT SỰ: cookie xoá được, IP đổi được, nhưng trần toàn cục
   * thì không phụ thuộc thứ gì client gửi lên. Nó là thứ chặn hoá đơn.
   */
  it("chặn ngay cả khi mỗi khách đều còn hạn mức riêng", async () => {
    let allowed = 0;
    for (let i = 0; i < GLOBAL_CALLS_PER_DAY + 50; i++) {
      // mỗi request một cookie khác nhau = hạn mức cá nhân luôn còn nguyên
      if (!isGateFailure(await checkGate(req({ aid: `khach${String(i).padStart(26, "0")}` }), 1))) allowed++;
    }
    expect(allowed).toBe(GLOBAL_CALLS_PER_DAY);
  });
});

describe("khách chưa có cookie", () => {
  it("được cấp id mới và vẫn bị tính lượt", async () => {
    const r = await checkGate(req(), 1);
    expect(isGateFailure(r)).toBe(false);
    if (!isGateFailure(r)) {
      expect(r.clientId).toMatch(/^[a-f0-9]{32}$/);
      expect(r.remaining).toBe(FREE_CALLS_PER_DAY - 1);
    }
  });

  it("mỗi request không cookie là một khách mới — hạn mức cá nhân KHÔNG chặn được", async () => {
    // Giới hạn đã biết và cố ý: cookie chỉ chặn tai nạn. Test này đóng băng sự
    // thật đó để không ai tưởng nhầm là đã an toàn.
    for (let i = 0; i < FREE_CALLS_PER_DAY + 5; i++) {
      expect(isGateFailure(await checkGate(req(), 1))).toBe(false);
    }
  });
});

describe("remainingFor", () => {
  it("không tiêu lượt nào", async () => {
    await remainingFor(req({ aid: "khach90000000000000000" }));
    await remainingFor(req({ aid: "khach90000000000000000" }));
    expect((await remainingFor(req({ aid: "khach90000000000000000" }))).remaining).toBe(FREE_CALLS_PER_DAY);
  });
});
