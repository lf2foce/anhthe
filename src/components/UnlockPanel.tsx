"use client";

/**
 * Mặt tiền thu tiền — hiện ở ĐẦU RA, đúng chỗ khách đang nhìn ảnh mình thích.
 *
 * Không có bước "đăng nhập" nào ở đây: phiên đã gắn với cookie ẩn danh, nên
 * khách trả tiền xong là mở khoá ngay. Bắt tạo tài khoản trước khi khách thấy
 * được giá trị là cách giết chuyển đổi nhanh nhất.
 *
 * Đối soát bằng tay: khách chuyển khoản kèm mã memo, chủ app xác nhận, khách bấm
 * "Tôi đã chuyển khoản" để hỏi lại trạng thái. Không webhook, không cổng.
 */

import { useState } from "react";
import { createOrder } from "@/lib/api";
import { formatVnd } from "@/lib/pricing";
import { ErrorNote, PrimaryButton } from "@/components/ui";

interface OrderInfo {
  memo: string;
  amountVnd: number;
  status: string;
  qrUrl: string;
}

export function UnlockPanel({
  sessionId,
  planId,
  lockedCount,
  onUnlocked,
}: {
  sessionId: string;
  planId: string;
  /** Số ảnh đang là bản xem thử */
  lockedCount: number;
  /** Gọi khi đơn chuyển sang đã trả — nơi gọi tự đi xin link bản sạch */
  onUnlocked: () => void;
}) {
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const o = await createOrder({ sessionId, planId });
      setOrder(o);
      if (o.status === "paid") onUnlocked();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Hỏi lại trạng thái. `createOrder` trả về đúng đơn cũ nên gọi lại là an toàn. */
  async function recheck() {
    setBusy(true);
    setError(null);
    try {
      const o = await createOrder({ sessionId, planId });
      setOrder(o);
      setChecked(true);
      if (o.status === "paid") onUnlocked();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (lockedCount === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-pop-ink bg-viol-1 p-3.5 shadow-[4px_4px_0_var(--color-pop-ink)]">
      <div className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-bold">
          {lockedCount} ảnh đang là bản xem thử
        </span>
        <span className="text-[11px] leading-snug text-pop-ink/60">
          Mở khoá để tải bản sạch, không có chữ chìm.
        </span>
      </div>

      {order ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-pop-ink bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.qrUrl}
            alt="Mã QR chuyển khoản"
            className="h-[190px] w-[190px] rounded-lg border border-pop-ink/15 bg-white object-contain"
          />
          <div className="text-center">
            <div className="font-display text-[20px] font-bold">
              {formatVnd(order.amountVnd)}
            </div>
            <div className="text-[11px] text-pop-ink/55">
              Nội dung chuyển khoản phải có mã
            </div>
            <div className="mt-0.5 select-all rounded-md border-2 border-pop-ink bg-sun-1 px-2.5 py-1 font-mono text-[15px] font-bold tracking-widest">
              {order.memo}
            </div>
          </div>
          <button
            onClick={recheck}
            disabled={busy}
            className="mt-1 w-full rounded-full border-2 border-pop-ink bg-white py-2.5 text-[12px] font-bold"
          >
            {busy ? "Đang kiểm tra…" : "Tôi đã chuyển khoản"}
          </button>
          {checked && order.status !== "paid" ? (
            <span className="text-center text-[11px] leading-snug text-pop-ink/55">
              Chưa thấy giao dịch. Chuyển khoản thường về sau vài phút — thử lại
              giúp nhé.
            </span>
          ) : null}
        </div>
      ) : (
        <PrimaryButton onClick={open} disabled={busy}>
          {busy ? "…" : "Mở khoá bản sạch"}
        </PrimaryButton>
      )}

      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}
