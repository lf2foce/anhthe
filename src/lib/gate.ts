import "server-only";

/**
 * Chốt chi phí cho các route gọi model — MỘT file, không phải một framework.
 *
 * Ba lớp, mạnh dần:
 *
 * 1. TRẦN DUNG LƯỢNG — chặn ngay trước khi đọc body. Không có nó thì một request
 *    40MB được nhận và xử lý (đã thử thật), và N request như vậy là OOM.
 * 2. HẠN MỨC THEO KHÁCH — cookie ẩn danh. Chỉ chặn TAI NẠN và lạm dụng vãng lai;
 *    xoá cookie là hết. Cố ý chấp nhận: mục tiêu là để người lạ dùng thử được,
 *    không phải xây pháo đài.
 * 3. TRẦN CHI TOÀN CỤC MỖI NGÀY — chốt cứng THẬT SỰ. Đây là thứ duy nhất chặn
 *    được kẻ cố ý, vì nó không phụ thuộc vào bất cứ thứ gì client gửi lên.
 *
 * KHO ĐẾM — vì sao phải nằm ngoài tiến trình:
 *
 * Bộ đếm trong RAM chỉ đúng khi chạy MỘT tiến trình. Trên serverless mỗi instance
 * có bộ đếm riêng, nên trần thật = trần × số instance — và số instance TĂNG đúng
 * lúc bị dội request, tức nó hỏng đúng lúc cần nhất. Dùng Postgres (Neon) làm kho
 * chung; không cần Redis, một bảng đếm là đủ và nó atomic sẵn.
 *
 * Không đặt `PHOTO_DATABASE_URL` thì rơi về RAM — đủ cho `npm run dev` và test,
 * KHÔNG đủ cho production nhiều instance.
 */

import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

/** Trần dung lượng body cho route nhận ảnh */
export const MAX_BODY_BYTES = 12 * 1024 * 1024;

/** Số lượt gọi model mỗi khách mỗi ngày (bậc dùng thử) */
export const FREE_CALLS_PER_DAY = Number(
  process.env.PHOTO_FREE_DAILY_CALLS ?? 12
);

/**
 * Trần số lượt gọi model toàn hệ thống mỗi ngày.
 * Đây là con số chặn hoá đơn. Đặt theo mức tiền tối đa chấp nhận mất trong một
 * ngày xấu nhất, KHÔNG đặt theo kỳ vọng lưu lượng.
 */
export const GLOBAL_CALLS_PER_DAY = Number(
  process.env.PHOTO_GLOBAL_DAILY_CALLS ?? 400
);

export const COOKIE_NAME = "aid";

/** Khoá của hàng đếm toàn cục. Không trùng được với id khách (32 ký tự hex). */
const GLOBAL_KEY = "__global__";

const dbUrl = process.env.PHOTO_DATABASE_URL;
const sql = dbUrl ? neon(dbUrl) : null;

export const usingSharedStore = sql !== null;

// ── Kho RAM: chỉ để dev/test ───────────────────────────────────────────────
const memory = new Map<string, { day: string; used: number }>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function memoryUsed(key: string): number {
  const c = memory.get(key);
  return c && c.day === today() ? c.used : 0;
}

/**
 * Cộng thêm `cost` NẾU không vượt `limit`, và trả về số đã dùng sau khi cộng.
 * `null` = vượt trần, KHÔNG cộng gì.
 *
 * Kiểm-rồi-cộng phải là MỘT thao tác nguyên tử. Tách làm hai (đọc, so, ghi) thì
 * hai request đồng thời cùng đọc thấy còn chỗ rồi cùng ghi — đúng kiểu lọt trần
 * mà chỉ hiện ra khi bị dội.
 */
async function claim(
  key: string,
  cost: number,
  limit: number
): Promise<number | null> {
  if (cost > limit) return null;

  if (!sql) {
    const used = memoryUsed(key);
    if (used + cost > limit) return null;
    memory.set(key, { day: today(), used: used + cost });
    // Dọn bộ nhớ: chỉ giữ khoá của HÔM NAY, nếu không Map phình mãi.
    if (memory.size > 5000) {
      for (const [k, v] of memory) if (v.day !== today()) memory.delete(k);
    }
    return used + cost;
  }

  // ON CONFLICT ... WHERE: vượt trần thì mệnh đề WHERE sai, không có hàng nào
  // được cập nhật và RETURNING rỗng — tức không cộng gì. Một câu, một vòng.
  const rows = await sql`
    INSERT INTO photo_quota (key, day, used)
    VALUES (${key}, CURRENT_DATE, ${cost})
    ON CONFLICT (key, day) DO UPDATE
      SET used = photo_quota.used + ${cost}
      WHERE photo_quota.used + ${cost} <= ${limit}
    RETURNING used
  `;
  return rows.length > 0 ? Number(rows[0].used) : null;
}

/** Đọc số đã dùng, không cộng gì */
async function peek(key: string): Promise<number> {
  if (!sql) return memoryUsed(key);
  const rows = await sql`
    SELECT used FROM photo_quota WHERE key = ${key} AND day = CURRENT_DATE
  `;
  return rows.length > 0 ? Number(rows[0].used) : 0;
}

/** Trả lại lượt đã trừ — dùng khi trừ xong mới phát hiện phải chặn */
async function refund(key: string, cost: number): Promise<void> {
  if (!sql) {
    const used = memoryUsed(key);
    memory.set(key, { day: today(), used: Math.max(0, used - cost) });
    return;
  }
  await sql`
    UPDATE photo_quota SET used = GREATEST(0, used - ${cost})
    WHERE key = ${key} AND day = CURRENT_DATE
  `;
}

// ── API ────────────────────────────────────────────────────────────────────

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
function clientIdOf(request: Request): string {
  const cookie = request.headers.get("cookie") ?? "";
  const m = /(?:^|;\s*)aid=([A-Za-z0-9_-]{8,64})/.exec(cookie);
  return m ? m[1] : crypto.randomUUID().replace(/-/g, "");
}

/**
 * Trần dung lượng. PHẢI gọi làm việc đầu tiên trong route — trước `request.json()`.
 *
 * Gọi sau khi parse là vô nghĩa: body đã được đọc và dựng thành chuỗi trong bộ
 * nhớ rồi mới đi kiểm, tức đúng cái mà trần này sinh ra để chặn đã xảy ra.
 */
export function checkSize(request: Request): GateFailure | null {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) {
    return fail("TOO_LARGE", "Ảnh quá lớn. Thử lại với ảnh nhỏ hơn 12MB.", 413);
  }
  return null;
}

/**
 * Kiểm tra trước khi gọi model.
 *
 * @param cost số lượt model request này SẼ tiêu. Trừ TRƯỚC khi gọi (chứ không
 *        trừ sau khi thành công) là cố ý: trừ sau thì một loạt request song song
 *        đều thấy bộ đếm còn nguyên và lọt hết.
 *
 * Kho đếm lỗi thì CHẶN, không cho qua. Một cú nấc của DB làm khách thấy "hệ
 * thống bận" là chuyện phục hồi được; một hoá đơn model không trần thì không.
 */
export async function checkGate(
  request: Request,
  cost: number
): Promise<GateFailure | GateResult> {
  const tooBig = checkSize(request);
  if (tooBig) return tooBig;

  const id = clientIdOf(request);

  try {
    // Trần toàn cục trước: nó là chốt cứng, và chặn ở đây thì khỏi đụng vào
    // hàng đếm của khách.
    const globalUsed = await claim(GLOBAL_KEY, cost, GLOBAL_CALLS_PER_DAY);
    if (globalUsed === null) {
      return fail(
        "GLOBAL_LIMIT",
        "Hệ thống đã đạt giới hạn xử lý trong ngày. Vui lòng quay lại vào ngày mai.",
        503
      );
    }

    const used = await claim(id, cost, FREE_CALLS_PER_DAY);
    if (used === null) {
      // Đã trừ toàn cục ở trên rồi mới biết khách hết lượt — phải trả lại, nếu
      // không thì mỗi lần khách bị chặn lại ăn mất một suất của trần chung.
      await refund(GLOBAL_KEY, cost);
      return fail(
        "QUOTA",
        `Bạn đã dùng hết ${FREE_CALLS_PER_DAY} lượt miễn phí hôm nay. Quay lại vào ngày mai nhé.`,
        429
      );
    }

    return { clientId: id, remaining: Math.max(0, FREE_CALLS_PER_DAY - used) };
  } catch (e) {
    console.error("[gate] kho đếm lỗi — chặn để giữ trần chi", e);
    return fail(
      "GATE_UNAVAILABLE",
      "Hệ thống đang bận. Thử lại sau ít phút nhé.",
      503
    );
  }
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
export async function remainingFor(request: Request): Promise<{
  remaining: number;
  perDay: number;
  clientId: string;
}> {
  const id = clientIdOf(request);
  let used = 0;
  try {
    used = await peek(id);
  } catch (e) {
    // Đọc hỏng thì báo đầy bình còn hơn báo hết — đây chỉ là con số hiển thị,
    // `checkGate` mới là chỗ quyết định.
    console.error("[gate] không đọc được hạn mức", e);
  }
  return {
    remaining: Math.max(0, FREE_CALLS_PER_DAY - used),
    perDay: FREE_CALLS_PER_DAY,
    clientId: id,
  };
}

/** Chỉ dùng trong test — kho RAM là trạng thái tiến trình, phải reset được */
export function __resetGate(): void {
  memory.clear();
}
