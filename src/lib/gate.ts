import "server-only";

/**
 * Chốt chi phí cho các route gọi model — MỘT file, không phải một framework.
 *
 * Ba lớp, mạnh dần:
 *
 * 1. TRẦN DUNG LƯỢNG — chặn ngay trước khi giải mã. Không có nó thì một request
 *    40MB được nhận và xử lý (đã thử thật), và N request như vậy là OOM.
 * 2. HẠN MỨC THEO KHÁCH — cookie ẩn danh. Chỉ chặn TAI NẠN và lạm dụng vãng lai;
 *    xoá cookie là hết. Cố ý chấp nhận: mục tiêu là để người lạ dùng thử được,
 *    không phải xây pháo đài.
 * 3. TRẦN CHI TOÀN CỤC MỖI NGÀY — chốt cứng THẬT SỰ. Đây là thứ duy nhất chặn
 *    được kẻ cố ý, vì nó không phụ thuộc vào bất cứ thứ gì client gửi lên.
 *
 * Bộ đếm nằm trong bộ nhớ tiến trình: đúng khi chạy MỘT tiến trình `next start`
 * (VPS, Docker). Trên serverless đa-instance nó đếm thiếu — lúc đó phải đổi sang
 * Redis/KV, và chỗ phải sửa là đúng hai hàm `bump`/`readCounter` bên dưới.
 */

import { NextResponse } from "next/server";

/** Trần dung lượng body cho route nhận ảnh */
export const MAX_BODY_BYTES = 12 * 1024 * 1024;

/** Số lượt gọi model mỗi khách mỗi ngày (bậc dùng thử) */
export const FREE_CALLS_PER_DAY = 12;

/**
 * Trần số lượt gọi model toàn hệ thống mỗi ngày.
 * Đây là con số chặn hoá đơn. Đặt theo mức tiền tối đa chấp nhận mất trong một
 * ngày xấu nhất, KHÔNG đặt theo kỳ vọng lưu lượng.
 */
export const GLOBAL_CALLS_PER_DAY = Number(
  process.env.PHOTO_GLOBAL_DAILY_CALLS ?? 400
);

export const COOKIE_NAME = "aid";

interface Counter {
  day: string;
  used: number;
}

const perClient = new Map<string, Counter>();
let global: Counter = { day: "", used: 0 };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCounter(c: Counter): number {
  return c.day === today() ? c.used : 0;
}

function bump(id: string, n: number): void {
  const day = today();
  const cur = perClient.get(id);
  perClient.set(id, {
    day,
    used: (cur && cur.day === day ? cur.used : 0) + n,
  });
  global = { day, used: readCounter(global) + n };

  // Dọn bộ nhớ: chỉ giữ khách của HÔM NAY. Không có bước này thì Map phình mãi.
  if (perClient.size > 5000) {
    for (const [k, v] of perClient) if (v.day !== day) perClient.delete(k);
  }
}

export interface GateResult {
  clientId: string;
  /** Số lượt còn lại của khách này hôm nay */
  remaining: number;
}

export type GateFailure = { response: NextResponse };

function fail(code: string, message: string, status: number): GateFailure {
  return { response: NextResponse.json({ error: message, code }, { status }) };
}

/** Đọc/cấp id ẩn danh. KHÔNG phải danh tính thật — chỉ để đếm. */
function clientIdOf(request: Request): { id: string; isNew: boolean } {
  const cookie = request.headers.get("cookie") ?? "";
  const m = /(?:^|;\s*)aid=([A-Za-z0-9_-]{8,64})/.exec(cookie);
  if (m) return { id: m[1], isNew: false };
  return { id: crypto.randomUUID().replace(/-/g, ""), isNew: true };
}

/**
 * Kiểm tra trước khi gọi model.
 *
 * @param cost số lượt model request này SẼ tiêu. Trừ trước (chứ không trừ sau
 *        khi thành công) là cố ý: nếu trừ sau, một kẻ bắn 100 request song song
 *        sẽ lọt hết vì lượt nào cũng thấy bộ đếm còn nguyên.
 */
/**
 * Trần dung lượng. PHẢI gọi làm việc đầu tiên trong route — trước `request.json()`.
 *
 * Gọi sau khi parse là vô nghĩa: 13MB đã được đọc và dựng thành chuỗi trong bộ
 * nhớ rồi mới đi kiểm, tức đúng cái mà trần này sinh ra để chặn đã xảy ra.
 */
export function checkSize(request: Request): GateFailure | null {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) {
    return fail("TOO_LARGE", "Ảnh quá lớn. Thử lại với ảnh nhỏ hơn 12MB.", 413);
  }
  return null;
}

export function checkGate(
  request: Request,
  cost: number
): GateFailure | GateResult {
  const tooBig = checkSize(request);
  if (tooBig) return tooBig;

  if (readCounter(global) + cost > GLOBAL_CALLS_PER_DAY) {
    return fail(
      "GLOBAL_LIMIT",
      "Hệ thống đã đạt giới hạn xử lý trong ngày. Vui lòng quay lại vào ngày mai.",
      503
    );
  }

  const { id } = clientIdOf(request);
  const used = readCounter(perClient.get(id) ?? { day: "", used: 0 });
  if (used + cost > FREE_CALLS_PER_DAY) {
    return fail(
      "QUOTA",
      `Bạn đã dùng hết ${FREE_CALLS_PER_DAY} lượt miễn phí hôm nay. Quay lại vào ngày mai nhé.`,
      429
    );
  }

  bump(id, cost);
  return { clientId: id, remaining: FREE_CALLS_PER_DAY - used - cost };
}

export function isGateFailure(v: GateFailure | GateResult): v is GateFailure {
  return "response" in v;
}

/** Gắn cookie ẩn danh vào response nếu khách chưa có */
export function withClientCookie(
  res: NextResponse,
  request: Request,
  clientId: string
): NextResponse {
  if (!/(?:^|;\s*)aid=/.test(request.headers.get("cookie") ?? "")) {
    res.cookies.set(COOKIE_NAME, clientId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

/** Số lượt còn lại — cho /api/me, không gọi model nên không tính phí */
export function remainingFor(request: Request): {
  remaining: number;
  perDay: number;
  clientId: string;
} {
  const { id } = clientIdOf(request);
  const used = readCounter(perClient.get(id) ?? { day: "", used: 0 });
  return {
    remaining: Math.max(0, FREE_CALLS_PER_DAY - used),
    perDay: FREE_CALLS_PER_DAY,
    clientId: id,
  };
}

/** Chỉ dùng trong test — bộ đếm là trạng thái tiến trình, phải reset được */
export function __resetGate(): void {
  perClient.clear();
  global = { day: "", used: 0 };
}
