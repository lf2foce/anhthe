import { describe, expect, it } from "vitest";
import { decideSepay, extractMemo } from "./sepay";

/**
 * Nội dung chuyển khoản KHÔNG BAO GIỜ sạch — mỗi ngân hàng mangle một kiểu.
 * Các ca dưới đây là kiểu thật hay gặp; hỏng một ca là một khách trả tiền mà
 * đơn không mở, và họ chỉ biết ngồi chờ.
 */
describe("extractMemo — tìm mã trong nội dung bẩn", () => {
  it("nội dung sạch", () => {
    expect(extractMemo("ATABC234")).toBe("ATABC234");
  });

  it("ngân hàng chèn tiền tố + hậu tố dán liền", () => {
    expect(extractMemo("MBVCB.3278907687.ATXYZ789.CT tu 0123 toi 0456")).toBe(
      "ATXYZ789"
    );
  });

  it("khách gõ thường và kèm lời nhắn", () => {
    expect(extractMemo("chuyen tien anh the atabc234 cam on shop")).toBe(
      "ATABC234"
    );
  });

  it("ưu tiên trường đứng trước (code của SePay) rồi mới tới content", () => {
    expect(extractMemo("ATAAA222", "ATBBB333")).toBe("ATAAA222");
    expect(extractMemo(null, "ATBBB333")).toBe("ATBBB333");
  });

  it("không có mã thì trả null — kể cả chữ 'AT' lạc trong câu", () => {
    expect(extractMemo("thanh toan tien nha thang 7")).toBeNull();
    // "AT" + 6 ký tự nhưng dính I/O/0/1 — ngoài bảng chữ memo, không được khớp
    expect(extractMemo("ATO12345 hello")).toBeNull();
  });
});

describe("decideSepay — gạt giao dịch không liên quan trước khi đụng DB", () => {
  const base = {
    transferType: "in",
    transferAmount: 49000,
    content: "ATABC234",
    code: null,
  };

  it("tiền vào + có mã → pay", () => {
    expect(decideSepay(base)).toEqual({
      action: "pay",
      memo: "ATABC234",
      amount: 49000,
    });
  });

  it("tiền RA cũng bắn webhook — phải lọc, kể cả khi nội dung có mã", () => {
    expect(decideSepay({ ...base, transferType: "out" }).action).toBe("ignore");
  });

  it("số tiền rác hoặc thiếu → ignore, không ném lỗi", () => {
    expect(decideSepay({ ...base, transferAmount: undefined }).action).toBe(
      "ignore"
    );
    expect(decideSepay({ ...base, transferAmount: -5 }).action).toBe("ignore");
  });

  it("không mã memo → ignore", () => {
    expect(
      decideSepay({ ...base, content: "chuyen khoan", code: null }).action
    ).toBe("ignore");
  });
});
