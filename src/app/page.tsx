import Link from "next/link";
import { PACKS } from "@/lib/packs";
import { PLANS, formatVnd } from "@/lib/pricing";
import { DOCS } from "@/lib/docs";

/**
 * Landing page — cửa vào cho người LẠ. Redesign "tươi trẻ, nhiều màu" (đợt 1).
 *
 * Ngôn ngữ hình: nền sáng ấm + mực tím than + 5 màu kẹo; thẻ bo lớn viền mực
 * 2px + bóng lệch cứng (sticker); ảnh mẫu xoay nhẹ như polaroid. Toàn bộ bằng
 * token + CSS thuần — không thêm ảnh trang trí nào để giữ trang tĩnh và nhẹ.
 *
 * Nguyên tắc giữ nguyên từ bản cũ: cho xem BẰNG CHỨNG trước khi đòi khuôn mặt
 * (ảnh mẫu là ảnh thật app sinh ra, người mẫu hư cấu), server component tĩnh.
 */

export const metadata = {
  title: "Ảnh thẻ Studio — ảnh thẻ đúng chuẩn và ảnh chân dung AI",
  description:
    "Chụp bằng điện thoại, AI kiểm tra 8 tiêu chuẩn, thay nền và xuất đủ cỡ đúng px/DPI kèm bản in ghép. Hoặc để AI vẽ lại bạn theo phong cách doanh nhân, áo dài, glamour.",
};

/** Chỉ khoe vài phong cách ở landing — vào app mới xem hết */
const SHOWCASE = PACKS.slice(0, 4);

/** Bóng lệch cứng — chữ ký của ngôn ngữ sticker, dùng lặp lại cho đồng bộ */
const POP = "shadow-[4px_4px_0_var(--color-pop-ink)]";

/** Mỗi mục một màu — xoay vòng qua 5 màu kẹo */
const TINTS = [
  { bg: "bg-viol-1", dot: "bg-viol" },
  { bg: "bg-pink-1", dot: "bg-pink" },
  { bg: "bg-mint-1", dot: "bg-mint" },
  { bg: "bg-sun-1", dot: "bg-sun" },
  { bg: "bg-sky-1", dot: "bg-sky" },
] as const;

export default function Landing() {
  const idDocs = DOCS.filter((d) => d.family === "id");

  return (
    // overflow-x-clip: các sticker cố ý xoay/thò nhẹ; không clip thì mobile có
    // thanh cuộn ngang vô duyên.
    <main className="min-h-dvh overflow-x-clip bg-pop-bg font-body text-pop-ink">
      {/* ── Thanh trên ──────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-5 pt-5 sm:px-8">
        <span className="font-display text-[19px] font-bold tracking-tight">
          Ảnh thẻ Studio
          <span className="pl-1 text-pink">✦</span>
        </span>
        <Link
          href="/app"
          className={`rounded-full border-2 border-pop-ink bg-sun px-4 py-2 text-[12.5px] font-bold ${POP}`}
        >
          Vào app
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 pb-14 pt-10 sm:px-8 lg:pb-20 lg:pt-16">
        {/* Bóng bay màu — trang trí thuần CSS, mờ để chữ vẫn là vua */}
        <div className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-viol-1" />
        <div className="pointer-events-none absolute -right-20 top-64 h-52 w-52 rounded-full bg-pink-1" />

        <div className="relative mx-auto grid max-w-[1120px] items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-5">
            <span
              className={`w-fit -rotate-2 rounded-full border-2 border-pop-ink bg-pink px-3.5 py-1.5 text-[11.5px] font-bold text-white ${POP}`}
            >
              Chụp một lần · đủ mọi cỡ
            </span>
            <h1 className="max-w-[16ch] font-display text-[42px] font-bold leading-[1.02] tracking-tight sm:text-[56px]">
              Ảnh thẻ{" "}
              {/* Highlight kiểu bút dạ: nền vàng lệch xuống dưới chữ */}
              <span className="relative inline-block">
                <span className="absolute inset-x-[-4px] bottom-[4px] top-[52%] -rotate-1 rounded-md bg-sun" />
                <span className="relative">đúng chuẩn</span>
              </span>
              , chụp bằng điện thoại
            </h1>
            <p className="max-w-[52ch] text-[15px] leading-relaxed text-pop-ink/70">
              Không phải &ldquo;AI làm cho đẹp&rdquo;. Máy <strong>đo</strong> tỉ
              lệ đầu, đường mắt và màu nền của tấm ảnh bạn sắp nộp — rồi cắt đúng
              từng pixel và DPI cho từng loại giấy tờ.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/app"
                className={`rounded-full border-2 border-pop-ink bg-viol px-7 py-3.5 text-[15px] font-bold text-white ${POP}`}
              >
                Làm thử miễn phí →
              </Link>
              <span className="text-[12.5px] font-semibold text-pop-ink/55">
                Không cần đăng ký · xong trong 2 phút
              </span>
            </div>

            {/* Mỗi loại giấy tờ một viên kẹo màu */}
            <div className="flex flex-wrap gap-2 pt-2">
              {idDocs.map((d, i) => (
                <span
                  key={d.id}
                  className={`rounded-full border-2 border-pop-ink px-3 py-1 text-[11.5px] font-bold ${TINTS[i % TINTS.length].bg}`}
                >
                  {d.vi} <span className="opacity-60">{d.dim}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Bằng chứng: ảnh THẬT do app sinh ra, xoay nhẹ như polaroid trên bàn.
              min-w-0 cả lưới lẫn từng figure: thiếu nó thì min-content của ảnh
              gốc (~450px) banh grid rộng hơn màn điện thoại — đã dính. */}
          <div className="grid min-w-0 grid-cols-2 gap-4 p-2">
            {SHOWCASE.map((p, i) => (
              <figure
                key={p.id}
                className={`relative m-0 min-w-0 overflow-hidden rounded-2xl border-2 border-pop-ink bg-white ${POP} ${
                  i % 2 ? "rotate-2" : "-rotate-2"
                }`}
                style={{ aspectRatio: "3 / 4" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumb}
                  alt={p.vi}
                  className="h-full w-full object-cover"
                />
                <figcaption
                  className={`absolute bottom-2 left-2 rounded-full border-2 border-pop-ink px-2.5 py-1 text-[10.5px] font-bold text-pop-ink ${TINTS[i % TINTS.length].bg}`}
                >
                  {p.vi}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Khác biệt: cái máy ĐO ────────────────────────────────────────── */}
      <section className="px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="max-w-[20ch] font-display text-[30px] font-bold leading-tight sm:text-[36px]">
            Chỗ khác biệt nằm ở thứ bạn không nhìn thấy
          </h2>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-pop-ink/70">
            Ảnh bị trả ở quầy hầu như không bao giờ vì &ldquo;xấu&rdquo;. Nó bị
            trả vì đầu to hơn 2 milimét, vì đường mắt lệch, vì nền không phải màu
            quy định. Đó là những con số — nên chúng tôi đo chúng, không đoán.
          </p>

          <div className="mt-9 grid gap-5 sm:grid-cols-3">
            {[
              {
                t: "Đo, không đoán",
                d: "Tỉ lệ đầu, đường mắt, khung cắt, px và DPI đều tính bằng số học rồi cắt bằng máy — không giao cho AI quyết.",
                tint: "bg-mint-1",
                dot: "bg-mint",
              },
              {
                t: "Kiểm lại chính AI",
                d: "Sau khi AI thay nền, máy đo lại màu nền của file thành phẩm. AI nói xong không có nghĩa là xong.",
                tint: "bg-sky-1",
                dot: "bg-sky",
              },
              {
                t: "Không sửa ảnh giấy tờ",
                d: "Ảnh thẻ chỉ được thay nền và làm nét. Đổi áo, làm thon mặt là sửa ảnh nhận dạng — chỉ có ở luồng chân dung.",
                tint: "bg-sun-1",
                dot: "bg-sun",
              },
            ].map((c, i) => (
              <div
                key={c.t}
                className={`rounded-3xl border-2 border-pop-ink p-6 ${c.tint} ${POP}`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 border-pop-ink text-[13px] font-bold ${c.dot} ${i === 2 ? "" : "text-white"}`}
                >
                  {i + 1}
                </span>
                <h3 className="mt-3 font-display text-[17px] font-bold">{c.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-pop-ink/70">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hai luồng ────────────────────────────────────────────────────── */}
      <section className="px-5 py-2 sm:px-8">
        <div className="mx-auto grid max-w-[1120px] gap-5 lg:grid-cols-2">
          <Link
            href="/app"
            className={`rounded-3xl border-2 border-pop-ink bg-mint-1 p-6 sm:p-8 ${POP}`}
          >
            <span className="rounded-full border-2 border-pop-ink bg-mint px-3 py-1 text-[11px] font-bold text-white">
              Luồng 1
            </span>
            <h3 className="mt-3 font-display text-[26px] font-bold leading-tight">
              Ảnh thẻ đúng chuẩn
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-pop-ink/70">
              Chọn loại giấy tờ, chụp một lần. AI chấm 8 tiêu chuẩn, thay nền
              đúng màu quy định, rồi xuất đủ mọi cỡ bạn cần kèm bản in ghép
              10×15 có dấu cắt.
            </p>
          </Link>
          <Link
            href="/app"
            className={`rounded-3xl border-2 border-pop-ink p-6 text-white sm:p-8 ${POP}`}
            style={{
              background: "linear-gradient(120deg, var(--color-viol), var(--color-pink))",
            }}
          >
            <span className="rounded-full border-2 border-white/80 px-3 py-1 text-[11px] font-bold">
              Luồng 2 ✨
            </span>
            <h3 className="mt-3 font-display text-[26px] font-bold leading-tight">
              Studio sáng tạo
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/85">
              AI vẽ lại bạn theo phong cách bạn chọn — doanh nhân, áo dài,
              glamour, cổ trang. Xem xong dặn AI chỉnh tiếp tới khi ưng. Khuôn
              mặt giữ nguyên là bạn.
            </p>
          </Link>
        </div>
      </section>

      {/* ── Giá ──────────────────────────────────────────────────────────── */}
      <section id="gia" className="px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="font-display text-[30px] font-bold leading-tight sm:text-[36px]">
            Giá
          </h2>
          <p className="mt-2.5 text-[14px] text-pop-ink/70">
            Trả theo lần dùng. Không gói tháng — vì ảnh thẻ không phải thứ cần
            mỗi tháng.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-3xl border-2 border-pop-ink p-6 ${
                  p.highlight ? `bg-viol-1 ${POP}` : "bg-white"
                }`}
              >
                {p.highlight ? (
                  <span
                    className={`absolute -top-3 right-5 -rotate-2 rounded-full border-2 border-pop-ink bg-sun px-2.5 py-0.5 text-[10.5px] font-bold ${POP}`}
                  >
                    Hay chọn nhất
                  </span>
                ) : null}
                <h3 className="text-[15px] font-bold">{p.vi}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-[32px] font-bold leading-none">
                    {formatVnd(p.priceVnd)}
                  </span>
                  <span className="text-[11.5px] text-pop-ink/55">{p.unitVi}</span>
                </div>
                <ul className="mt-4 flex flex-1 list-none flex-col gap-2 p-0 text-[12.5px] leading-snug text-pop-ink/75">
                  {p.featuresVi.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="flex-none font-bold text-mint">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[11.5px] text-pop-ink/50">
            Thanh toán chưa mở — bản đang chạy cho dùng thử miễn phí trong hạn
            mức ngày.
          </p>
        </div>
      </section>

      {/* ── CTA cuối ─────────────────────────────────────────────────────── */}
      <section className="px-5 pb-16 sm:px-8">
        <div
          className={`mx-auto max-w-[1120px] rounded-[36px] border-2 border-pop-ink bg-viol px-6 py-14 text-center text-white ${POP}`}
        >
          <h2 className="mx-auto max-w-[20ch] font-display text-[30px] font-bold leading-tight sm:text-[36px]">
            Thử một tấm xem sao
          </h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-[14px] text-white/80">
            Không cần tài khoản. Ưng rồi mới tính chuyện đăng nhập.
          </p>
          <Link
            href="/app"
            className={`mt-7 inline-block rounded-full border-2 border-pop-ink bg-sun px-8 py-4 text-[15px] font-bold text-pop-ink ${POP}`}
          >
            Bắt đầu →
          </Link>
        </div>
      </section>

      <footer className="px-5 pb-8 text-center text-[11.5px] text-pop-ink/50 sm:px-8">
        Ảnh sáng tạo do AI vẽ lại — không dùng làm giấy tờ tuỳ thân.
      </footer>
    </main>
  );
}
