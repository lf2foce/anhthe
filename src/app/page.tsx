import Link from "next/link";
import { PACKS } from "@/lib/packs";
import { PLANS, formatVnd } from "@/lib/pricing";
import { DOCS } from "@/lib/docs";

/**
 * Landing page — cửa vào cho người LẠ.
 *
 * Nguyên tắc: cho xem BẰNG CHỨNG trước khi đòi khuôn mặt. Ảnh mẫu ở đây là ảnh
 * thật do chính app sinh ra (public/packs/, người mẫu hư cấu), không phải stock —
 * nên thứ khách thấy đúng bằng thứ khách nhận.
 *
 * Server component tĩnh: không state, không gọi model, render sẵn — vào là thấy
 * ngay kể cả mạng yếu.
 */

export const metadata = {
  title: "Ảnh thẻ Studio — ảnh thẻ đúng chuẩn và ảnh chân dung AI",
  description:
    "Chụp bằng điện thoại, AI kiểm tra 8 tiêu chuẩn, thay nền và xuất đủ cỡ đúng px/DPI kèm bản in ghép. Hoặc để AI vẽ lại bạn theo phong cách doanh nhân, áo dài, glamour.",
};

/** Chỉ khoe vài phong cách ở landing — vào app mới xem hết */
const SHOWCASE = PACKS.slice(0, 4);

export default function Landing() {
  const idDocs = DOCS.filter((d) => d.family === "id");

  return (
    <main className="min-h-dvh bg-n900 text-n100">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 pb-14 pt-14 sm:px-8 lg:pb-20 lg:pt-24">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-g800 opacity-45 blur-[130px]" />
        <div className="pointer-events-none absolute -right-40 top-20 h-[460px] w-[460px] rounded-full bg-a800 opacity-40 blur-[130px]" />

        <div className="relative mx-auto grid max-w-[1120px] items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-a300">
              Phòng tối · Ảnh thẻ Studio
            </span>
            <h1 className="max-w-[16ch] text-[40px] leading-[1.04] tracking-tight sm:text-[52px]">
              Ảnh thẻ đúng chuẩn, chụp bằng điện thoại
            </h1>
            <p className="max-w-[52ch] text-[15px] leading-relaxed text-n400">
              Không phải &ldquo;AI làm cho đẹp&rdquo;. Máy <strong className="text-n200">đo</strong>{" "}
              tỉ lệ đầu, đường mắt và màu nền của tấm ảnh bạn sắp nộp — rồi cắt đúng
              từng pixel và DPI cho từng loại giấy tờ.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/app"
                className="rounded-full bg-accent px-7 py-3.5 text-[14.5px] font-bold text-white shadow-lg"
              >
                Làm thử miễn phí
              </Link>
              <span className="text-[12.5px] text-n500">
                Không cần đăng ký · xong trong 2 phút
              </span>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-2 text-[12px] text-n500">
              {idDocs.map((d) => (
                <span key={d.id}>
                  {d.vi} <span className="text-n600">{d.dim}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Bằng chứng: ảnh THẬT do app sinh ra, không phải stock */}
          <div className="grid grid-cols-2 gap-3">
            {SHOWCASE.map((p) => (
              <figure
                key={p.id}
                className="relative overflow-hidden rounded-2xl ring-1 ring-n700"
                style={{ background: p.gradient, aspectRatio: "3 / 4" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumb}
                  alt={p.vi}
                  className="h-full w-full object-cover"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8 text-[11.5px] font-bold text-white">
                  {p.vi}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Khác biệt: cái máy ĐO ────────────────────────────────────────── */}
      <section className="border-t border-n800 px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="max-w-[20ch] text-[28px] leading-tight sm:text-[34px]">
            Chỗ khác biệt nằm ở thứ bạn không nhìn thấy
          </h2>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-n400">
            Ảnh bị trả ở quầy hầu như không bao giờ vì &ldquo;xấu&rdquo;. Nó bị trả vì
            đầu to hơn 2 milimét, vì đường mắt lệch, vì nền không phải màu quy định.
            Đó là những con số — nên chúng tôi đo chúng, không đoán.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "Đo, không đoán",
                d: "Tỉ lệ đầu, đường mắt, khung cắt, px và DPI đều tính bằng số học rồi cắt bằng máy — không giao cho AI quyết.",
              },
              {
                t: "Kiểm lại chính AI",
                d: "Sau khi AI thay nền, máy đo lại màu nền của file thành phẩm. AI nói xong không có nghĩa là xong.",
              },
              {
                t: "Không sửa ảnh giấy tờ",
                d: "Ảnh thẻ chỉ được thay nền và làm nét. Đổi áo, làm thon mặt là sửa ảnh nhận dạng — chỉ có ở luồng chân dung.",
              },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-2xl bg-n800/60 p-5 ring-1 ring-n800"
              >
                <h3 className="text-[15px] font-bold">{c.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-n400">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hai luồng ────────────────────────────────────────────────────── */}
      <section className="border-t border-n800 px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-[1120px] gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-n800/50 p-6 ring-1 ring-n800 sm:p-8">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-a300">
              Luồng 1
            </span>
            <h3 className="mt-2 text-[24px] leading-tight">Ảnh thẻ đúng chuẩn</h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-n400">
              Chọn loại giấy tờ, chụp một lần. AI chấm 8 tiêu chuẩn, thay nền đúng
              màu quy định, rồi xuất đủ mọi cỡ bạn cần kèm bản in ghép 10×15 có dấu cắt.
            </p>
          </div>
          <div className="rounded-3xl bg-n800/50 p-6 ring-1 ring-n800 sm:p-8">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-a300">
              Luồng 2
            </span>
            <h3 className="mt-2 text-[24px] leading-tight">Studio sáng tạo</h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-n400">
              AI vẽ lại bạn theo phong cách bạn chọn — doanh nhân, áo dài, glamour,
              cổ trang. Xem xong dặn AI chỉnh tiếp tới khi ưng. Khuôn mặt giữ nguyên
              là bạn.
            </p>
          </div>
        </div>
      </section>

      {/* ── Giá ──────────────────────────────────────────────────────────── */}
      <section id="gia" className="border-t border-n800 px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="text-[28px] leading-tight sm:text-[34px]">Giá</h2>
          <p className="mt-2.5 text-[14px] text-n400">
            Trả theo lần dùng. Không gói tháng — vì ảnh thẻ không phải thứ cần mỗi tháng.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`flex flex-col rounded-2xl p-6 ${
                  p.highlight
                    ? "bg-n800 ring-2 ring-accent"
                    : "bg-n800/50 ring-1 ring-n800"
                }`}
              >
                <h3 className="text-[15px] font-bold">{p.vi}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-[30px] font-bold leading-none">
                    {formatVnd(p.priceVnd)}
                  </span>
                  <span className="text-[11.5px] text-n500">{p.unitVi}</span>
                </div>
                <ul className="mt-4 flex flex-1 list-none flex-col gap-2 p-0 text-[12.5px] leading-snug text-n300">
                  {p.featuresVi.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="flex-none text-g400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[11.5px] text-n600">
            Thanh toán chưa mở — bản đang chạy cho dùng thử miễn phí trong hạn mức ngày.
          </p>
        </div>
      </section>

      {/* ── CTA cuối ─────────────────────────────────────────────────────── */}
      <section className="border-t border-n800 px-5 py-16 text-center sm:px-8">
        <h2 className="mx-auto max-w-[20ch] text-[28px] leading-tight sm:text-[34px]">
          Thử một tấm xem sao
        </h2>
        <p className="mx-auto mt-3 max-w-[46ch] text-[14px] text-n400">
          Không cần tài khoản. Ưng rồi mới tính chuyện đăng nhập.
        </p>
        <Link
          href="/app"
          className="mt-7 inline-block rounded-full bg-accent px-8 py-4 text-[15px] font-bold text-white shadow-lg"
        >
          Bắt đầu
        </Link>
      </section>

      <footer className="border-t border-n800 px-5 py-8 text-center text-[11.5px] text-n600 sm:px-8">
        Ảnh sáng tạo do AI vẽ lại — không dùng làm giấy tờ tuỳ thân.
      </footer>
    </main>
  );
}
