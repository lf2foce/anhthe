"use client";

import { useState } from "react";

/**
 * Ô nhập token cho trang quản trị.
 *
 * Client component chỉ vì cần một ô input — KHÔNG kiểm token ở đây. Kiểm nằm ở
 * server component: nhập sai thì trang không bao giờ render số nào, còn ở đây
 * chỉ là chỗ gõ rồi nạp lại trang kèm query.
 */
export function AdminGate() {
  const [token, setToken] = useState("");

  return (
    <main className="grid min-h-dvh place-items-center bg-pop-bg px-5 font-body text-pop-ink">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          window.location.search = `?token=${encodeURIComponent(token)}`;
        }}
        className="flex w-full max-w-[340px] flex-col gap-2.5 rounded-2xl border-2 border-pop-ink bg-white p-5 shadow-[4px_4px_0_var(--color-pop-ink)]"
      >
        <h1 className="font-display text-[19px] font-bold">Bảng điều khiển</h1>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token quản trị"
          autoFocus
          className="rounded-full border-2 border-pop-ink/20 bg-white px-4 py-2.5 text-[13px] outline-none placeholder:text-pop-ink/40 focus:border-viol"
        />
        <button className="rounded-full border-2 border-pop-ink bg-viol py-2.5 text-[13px] font-bold text-white shadow-[3px_3px_0_var(--color-pop-ink)]">
          Xem số liệu
        </button>
      </form>
    </main>
  );
}
