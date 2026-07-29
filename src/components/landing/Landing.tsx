import Link from "next/link";
import { PACKS } from "@/lib/packs";
import { PLANS, formatVnd } from "@/lib/pricing";
import { DOCS } from "@/lib/docs";
import { LANDING } from "@/lib/landing";
import type { Lang } from "@/lib/i18n";

/**
 * Landing page — cửa vào cho người LẠ, dùng chung cho cả hai ngôn ngữ.
 *
 * Hai locale là hai ROUTE TĨNH (`/` và `/en`) chứ không phải một trang có nút
 * đổi state: landing là trang bán hàng, phải render sẵn để vào là thấy ngay kể
 * cả mạng yếu, và mỗi ngôn ngữ cần URL riêng để chia sẻ và cho máy tìm kiếm.
 *
 * Nguyên tắc giữ nguyên: cho xem BẰNG CHỨNG trước khi đòi khuôn mặt (ảnh mẫu là
 * ảnh thật app sinh ra, người mẫu hư cấu).
 */

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

/** Chỉ khoe vài phong cách ở landing — vào app mới xem hết */
const SHOWCASE = PACKS.slice(0, 4);

const CARD_TINTS = [
  { tint: "bg-mint-1", dot: "bg-mint" },
  { tint: "bg-sky-1", dot: "bg-sky" },
  { tint: "bg-sun-1", dot: "bg-sun" },
] as const;

export function Landing({ lang }: { lang: Lang }) {
  const c = LANDING[lang];
  const idDocs = DOCS.filter((d) => d.family === "id");
  // Link sang app mang theo ngôn ngữ: khách đọc landing tiếng Anh mà vào app ra
  // tiếng Việt là bắt họ đi tìm nút đổi.
  const appHref = lang === "en" ? "/app?lang=en" : "/app";
  const otherHref = lang === "en" ? "/" : "/en";

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
        <div className="flex items-center gap-2">
          {/* Đổi ngôn ngữ = đổi ROUTE, không phải đổi state — URL chia sẻ được
              và máy tìm kiếm đánh chỉ mục được từng bản. */}
          <Link
            href={otherHref}
            className="rounded-full border-2 border-pop-ink/15 bg-white px-3.5 py-2 text-[12.5px] font-bold text-pop-ink/60"
          >
            {c.switchTo}
          </Link>
          <Link
            href={appHref}
            className={`rounded-full border-2 border-pop-ink bg-sun px-4 py-2 text-[12.5px] font-bold ${POP}`}
          >
            {c.navApp}
          </Link>
        </div>
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
              {c.badge}
            </span>
            <h1 className="max-w-[16ch] font-display text-[42px] font-bold leading-[1.02] tracking-tight sm:text-[56px]">
              {c.h1Pre}
              {/* Highlight kiểu bút dạ: nền vàng lệch xuống dưới chữ */}
              <span className="relative inline-block">
                <span className="absolute inset-x-[-4px] bottom-[4px] top-[52%] -rotate-1 rounded-md bg-sun" />
                <span className="relative">{c.h1Mark}</span>
              </span>
              {c.h1Post}
            </h1>
            <p className="max-w-[52ch] text-[15px] leading-relaxed text-pop-ink/70">
              <strong>{c.heroBodyStrong}</strong>
              {c.heroBody}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={appHref}
                className={`rounded-full border-2 border-pop-ink bg-viol px-7 py-3.5 text-[15px] font-bold text-white ${POP}`}
              >
                {c.ctaTry}
              </Link>
              <span className="text-[12.5px] font-semibold text-pop-ink/55">
                {c.ctaNote}
              </span>
            </div>

            {/* Mỗi loại giấy tờ một viên kẹo màu */}
            <div className="flex flex-wrap gap-2 pt-2">
              {idDocs.map((d, i) => (
                <span
                  key={d.id}
                  className={`rounded-full border-2 border-pop-ink px-3 py-1 text-[11.5px] font-bold ${TINTS[i % TINTS.length].bg}`}
                >
                  {lang === "vi" ? d.vi : d.en}{" "}
                  <span className="opacity-60">{d.dim}</span>
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
                  alt={lang === "vi" ? p.vi : p.en}
                  className="h-full w-full object-cover"
                />
                <figcaption
                  className={`absolute bottom-2 left-2 rounded-full border-2 border-pop-ink px-2.5 py-1 text-[10.5px] font-bold text-pop-ink ${TINTS[i % TINTS.length].bg}`}
                >
                  {lang === "vi" ? p.vi : p.en}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trước / Sau ──────────────────────────────────────────────────────
          Bằng chứng mạnh nhất của sản phẩm, nên đứng ngay sau hero: một cặp ảnh
          nói nhanh hơn mọi câu về px và DPI. Hai ảnh là ảnh THẬT do chính app
          sinh ra (người mẫu hư cấu), bản "sau" cắt bằng đúng phép toán của bước
          xuất — quảng cáo bằng ảnh dựng tay là hứa thứ mình không giao. */}
      <section className="px-5 pb-4 sm:px-8">
        <div className="mx-auto max-w-[1120px] rounded-[36px] border-2 border-pop-ink bg-viol-1 p-6 sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
            <div className="flex flex-col gap-4">
              <span
                className={`w-fit -rotate-1 rounded-full border-2 border-pop-ink bg-white px-3 py-1 text-[11px] font-bold ${POP}`}
              >
                {c.wowTag}
              </span>
              <h2 className="max-w-[16ch] font-display text-[30px] font-bold leading-[1.06] sm:text-[38px]">
                {c.wowTitle}
              </h2>
              <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-pop-ink/70">
                {c.wowBody}
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {c.wowSteps.map((step, i) => (
                  <li key={step} className="flex items-start gap-2.5 text-[13.5px] font-semibold">
                    <span
                      className={`mt-px grid h-5 w-5 flex-none place-items-center rounded-full border-2 border-pop-ink text-[10px] font-bold text-white ${CARD_TINTS[i].dot}`}
                    >
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
              <p className="m-0 max-w-[46ch] text-[11.5px] leading-snug text-pop-ink/55">
                {c.wowFinePrint}
              </p>
            </div>

            {/* Hai ảnh CÙNG khung, cùng cỡ — lệch cỡ là mắt tự quy đổi thành
                "ảnh sau đẹp hơn vì to hơn", tức khoe sai chỗ. */}
            <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-5">
              {[
                { src: "/hero-before.jpg", label: c.wowBefore, sub: c.wowBeforeSub, tint: "bg-white", rot: "-rotate-2" },
                { src: "/hero-after.jpg", label: c.wowAfter, sub: c.wowAfterSub, tint: "bg-mint", rot: "rotate-2" },
              ].map((it, i) => (
                <figure key={it.src} className="m-0 flex min-w-0 flex-col gap-2">
                  <div
                    className={`overflow-hidden rounded-2xl border-2 border-pop-ink bg-white ${POP} ${it.rot}`}
                    style={{ aspectRatio: "3 / 4" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.src}
                      alt={it.label}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <figcaption className="flex flex-col gap-0.5 px-0.5 pt-1">
                    <span
                      className={`w-fit rounded-full border-2 border-pop-ink px-2.5 py-0.5 text-[10.5px] font-bold ${it.tint} ${i === 1 ? "text-white" : ""}`}
                    >
                      {it.label}
                    </span>
                    <span className="text-[10.5px] leading-snug text-pop-ink/55">
                      {it.sub}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Khác biệt: cái máy ĐO ────────────────────────────────────────── */}
      <section className="px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="max-w-[20ch] font-display text-[30px] font-bold leading-tight sm:text-[36px]">
            {c.whyTitle}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-pop-ink/70">
            {c.whyBody}
          </p>

          <div className="mt-9 grid gap-5 sm:grid-cols-3">
            {c.cards.map((card, i) => (
              <div
                key={card.t}
                className={`rounded-3xl border-2 border-pop-ink p-6 ${CARD_TINTS[i].tint} ${POP}`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 border-pop-ink text-[13px] font-bold ${CARD_TINTS[i].dot} ${i === 2 ? "" : "text-white"}`}
                >
                  {i + 1}
                </span>
                <h3 className="mt-3 font-display text-[17px] font-bold">
                  {card.t}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-pop-ink/70">
                  {card.d}
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
            href={appHref}
            className={`rounded-3xl border-2 border-pop-ink bg-mint-1 p-6 sm:p-8 ${POP}`}
          >
            <span className="rounded-full border-2 border-pop-ink bg-mint px-3 py-1 text-[11px] font-bold text-white">
              {c.flow1Tag}
            </span>
            <h3 className="mt-3 font-display text-[26px] font-bold leading-tight">
              {c.flow1Title}
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-pop-ink/70">
              {c.flow1Body}
            </p>
          </Link>
          <Link
            href={appHref}
            className={`rounded-3xl border-2 border-pop-ink p-6 text-white sm:p-8 ${POP}`}
            style={{
              background: "linear-gradient(120deg, var(--color-viol), var(--color-pink))",
            }}
          >
            <span className="rounded-full border-2 border-white/80 px-3 py-1 text-[11px] font-bold">
              {c.flow2Tag}
            </span>
            <h3 className="mt-3 font-display text-[26px] font-bold leading-tight">
              {c.flow2Title}
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/85">
              {c.flow2Body}
            </p>
          </Link>
        </div>
      </section>

      {/* ── Giá ──────────────────────────────────────────────────────────── */}
      <section id="gia" className="px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="font-display text-[30px] font-bold leading-tight sm:text-[36px]">
            {c.priceTitle}
          </h2>
          <p className="mt-2.5 text-[14px] text-pop-ink/70">
            {c.priceBody}
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
                    {c.priceBadge}
                  </span>
                ) : null}
                <h3 className="text-[15px] font-bold">
                  {lang === "vi" ? p.vi : p.en}
                </h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-[32px] font-bold leading-none">
                    {formatVnd(p.priceVnd)}
                  </span>
                  <span className="text-[11.5px] text-pop-ink/55">
                    {lang === "vi" ? p.unitVi : p.unitEn}
                  </span>
                </div>
                <ul className="mt-4 flex flex-1 list-none flex-col gap-2 p-0 text-[12.5px] leading-snug text-pop-ink/75">
                  {(lang === "vi" ? p.featuresVi : p.featuresEn).map((f) => (
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
            {c.priceNote}
          </p>
        </div>
      </section>

      {/* ── CTA cuối ─────────────────────────────────────────────────────── */}
      <section className="px-5 pb-16 sm:px-8">
        <div
          className={`mx-auto max-w-[1120px] rounded-[36px] border-2 border-pop-ink bg-viol px-6 py-14 text-center text-white ${POP}`}
        >
          <h2 className="mx-auto max-w-[20ch] font-display text-[30px] font-bold leading-tight sm:text-[36px]">
            {c.endTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-[14px] text-white/80">
            {c.endBody}
          </p>
          <Link
            href={appHref}
            className={`mt-7 inline-block rounded-full border-2 border-pop-ink bg-sun px-8 py-4 text-[15px] font-bold text-pop-ink ${POP}`}
          >
            {c.endCta}
          </Link>
        </div>
      </section>

      <footer className="px-5 pb-8 text-center text-[11.5px] text-pop-ink/50 sm:px-8">
        {c.footer}
      </footer>
    </main>
  );
}
