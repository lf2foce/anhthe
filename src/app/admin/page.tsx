import { adminStats, ordersAvailable } from "@/lib/orders";
import { formatVnd } from "@/lib/pricing";
import { GLOBAL_CALLS_PER_DAY } from "@/lib/gate";
import { AdminGate } from "@/components/admin/AdminGate";

/**
 * Dashboard chủ app — doanh thu, đơn, lượt gọi model.
 *
 * Vào bằng `?token=<PHOTO_ADMIN_TOKEN>`; không token thì trang chỉ hiện ô nhập,
 * KHÔNG hiện số nào. Cố ý không xây đăng nhập riêng: đây là trang cho ĐÚNG MỘT
 * người, và token đó vốn đã là mật khẩu của route đánh dấu đã trả tiền.
 *
 * `noindex` + `dynamic` để không bị đánh chỉ mục và không bị cache số liệu.
 */
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = process.env.PHOTO_ADMIN_TOKEN;
  const given = (await searchParams).token;

  // Không đặt token thì trang TẮT hẳn — mặc định mở là ai cũng xem được doanh thu.
  if (!token) {
    return (
      <Shell>
        <p className="text-[13px] text-pop-ink/60">
          Chưa đặt <code>PHOTO_ADMIN_TOKEN</code> — trang này đang tắt.
        </p>
      </Shell>
    );
  }
  if (given !== token) return <AdminGate />;

  if (!ordersAvailable) {
    return (
      <Shell>
        <p className="text-[13px] text-pop-ink/60">
          Chưa nối cơ sở dữ liệu (<code>PHOTO_DATABASE_URL</code>) — không có số
          liệu để hiện.
        </p>
      </Shell>
    );
  }

  const s = (await adminStats())!;
  const peak = Math.max(1, ...s.daily.map((d) => d.revenue));

  return (
    <Shell>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Doanh thu hôm nay" value={formatVnd(s.revenueToday)} tint="bg-mint-1" sub={`${s.paidToday} đơn`} />
        <Stat label="30 ngày" value={formatVnd(s.revenue30)} tint="bg-viol-1" sub={`${s.paid30} đơn`} />
        <Stat label="Đơn đang chờ" value={String(s.pendingCount)} tint="bg-sun-1" sub="chưa nhận tiền" />
        <Stat
          label="Lượt model hôm nay"
          value={`${s.callsToday}/${GLOBAL_CALLS_PER_DAY}`}
          tint={s.callsToday > GLOBAL_CALLS_PER_DAY * 0.8 ? "bg-pink-1" : "bg-sky-1"}
          sub="trần chi toàn hệ thống"
        />
      </div>

      {/* Cột doanh thu 14 ngày — thanh dựng bằng CSS, không thêm thư viện biểu
          đồ cho một hình đơn giản thế này. */}
      <section className="rounded-2xl border-2 border-pop-ink bg-white p-4 shadow-[4px_4px_0_var(--color-pop-ink)]">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-pop-ink/50">
          Doanh thu 14 ngày
        </h2>
        {/* Cột cao theo PHẦN TRĂM, nên mỗi cột phải nằm trong một cha CÓ CHIỀU
            CAO THẬT (`h-full`) — cha cao `auto` thì phần trăm không có gì để quy
            chiếu và cột co về 0 (đã dính: biểu đồ ra một hàng gạch phẳng). */}
        <div className="mt-4 flex h-[150px] items-stretch gap-1.5">
          {s.daily.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col justify-end gap-1">
                <span className="text-center text-[9px] font-bold text-pop-ink/45">
                  {d.revenue > 0 ? Math.round(d.revenue / 1000) + "k" : ""}
                </span>
                <div
                  className={`w-full rounded-t border-2 border-pop-ink ${
                    d.revenue > 0 ? "bg-viol" : "bg-pop-ink/10"
                  }`}
                  style={{
                    height: d.revenue > 0 ? `${(d.revenue / peak) * 100}%` : "3px",
                  }}
                  title={`${d.day}: ${formatVnd(d.revenue)} · ${d.orders} đơn`}
                />
              </div>
              <span className="pt-1 text-center text-[8.5px] text-pop-ink/40">
                {d.day.slice(8)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {s.byPlan.length > 0 ? (
        <section className="rounded-2xl border-2 border-pop-ink bg-white p-4 shadow-[4px_4px_0_var(--color-pop-ink)]">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-pop-ink/50">
            Theo gói
          </h2>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {s.byPlan.map((p) => (
              <div key={p.planId} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-bold">{p.planId}</span>
                <span className="text-pop-ink/55">{p.orders} đơn</span>
                <span className="ml-auto font-bold text-viol">{formatVnd(p.revenue)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border-2 border-pop-ink bg-white p-4 shadow-[4px_4px_0_var(--color-pop-ink)]">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-pop-ink/50">
          20 đơn gần nhất
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-pop-ink/45">
                <th className="py-1.5">Mã</th>
                <th>Gói</th>
                <th>Tiền</th>
                <th>Email</th>
                <th>Tạo lúc</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((o) => (
                <tr key={o.memo} className="border-t border-pop-ink/10">
                  <td className="py-1.5 font-mono font-bold">{o.memo}</td>
                  <td className="text-pop-ink/70">{o.planId}</td>
                  <td className="font-semibold">{formatVnd(o.amountVnd)}</td>
                  <td className="text-pop-ink/55">{o.email ?? "—"}</td>
                  <td className="whitespace-nowrap text-pop-ink/55">
                    {fmtTime(o.createdAt)}
                  </td>
                  <td>
                    <span
                      className={`rounded-full border-2 border-pop-ink px-2 py-0.5 text-[10px] font-bold ${
                        o.status === "paid" ? "bg-mint text-white" : "bg-sun-1"
                      }`}
                    >
                      {o.status === "paid" ? "đã trả" : "đang chờ"}
                    </span>
                  </td>
                </tr>
              ))}
              {s.recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-pop-ink/45">
                    Chưa có đơn nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

/**
 * Giờ VN, định dạng gọn. `timeZone` khai TƯỜNG MINH: trang này render ở server
 * (Vercel chạy UTC), không khai thì chủ app đọc doanh thu "hôm nay" lệch 7 tiếng
 * so với ngày làm việc thật của mình.
 */
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-pop-bg px-5 py-8 font-body text-pop-ink sm:px-8">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
        <h1 className="font-display text-[24px] font-bold">
          Bảng điều khiển
          <span className="pl-1.5 text-pink">✦</span>
        </h1>
        {children}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub: string;
  tint: string;
}) {
  return (
    <div className={`rounded-2xl border-2 border-pop-ink p-4 shadow-[4px_4px_0_var(--color-pop-ink)] ${tint}`}>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-pop-ink/50">
        {label}
      </div>
      <div className="mt-1 font-display text-[24px] font-bold leading-none">
        {value}
      </div>
      <div className="mt-1 text-[10.5px] text-pop-ink/50">{sub}</div>
    </div>
  );
}
