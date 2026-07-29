/**
 * Chữ của landing page, song ngữ.
 *
 * Tách khỏi `i18n.ts` (chữ trong app) vì hai thứ có vòng đời khác nhau: chữ
 * landing là lời chào hàng, sửa theo cách bán; chữ app là nhãn thao tác, sửa
 * theo tính năng. Trộn vào một file thì mỗi lần đổi câu quảng cáo lại phải lướt
 * qua trăm nhãn nút.
 *
 * Giá, tên gói, tên loại giấy tờ, tên phong cách KHÔNG nằm ở đây — chúng đã
 * song ngữ sẵn trong `pricing.ts` / `docs.ts` / `packs.ts`, và một con số chỉ
 * được có MỘT chỗ định nghĩa.
 */

import type { Lang } from "./i18n";

export interface LandingCopy {
  metaTitle: string;
  metaDescription: string;

  navApp: string;
  /** Nhãn nút đổi ngôn ngữ — chữ của NGÔN NGỮ KIA (đích đến), không phải hiện tại */
  switchTo: string;

  badge: string;
  /** Tiêu đề tách ba mảnh để tô nền bút dạ đúng cụm giữa */
  h1Pre: string;
  h1Mark: string;
  h1Post: string;
  heroBody: string;
  heroBodyStrong: string;
  ctaTry: string;
  ctaNote: string;

  whyTitle: string;
  whyBody: string;
  cards: ReadonlyArray<{ t: string; d: string }>;

  flow1Tag: string;
  flow1Title: string;
  flow1Body: string;
  flow2Tag: string;
  flow2Title: string;
  flow2Body: string;

  priceTitle: string;
  priceBody: string;
  priceBadge: string;
  priceNote: string;

  endTitle: string;
  endBody: string;
  endCta: string;

  footer: string;
}

export const LANDING: Record<Lang, LandingCopy> = {
  vi: {
    metaTitle: "Ảnh thẻ Studio — ảnh thẻ đúng chuẩn và ảnh chân dung AI",
    metaDescription:
      "Chụp bằng điện thoại, AI kiểm tra 8 tiêu chuẩn, thay nền và xuất đủ cỡ đúng px/DPI kèm bản in ghép. Hoặc để AI vẽ lại bạn theo phong cách doanh nhân, áo dài, glamour.",

    navApp: "Vào app",
    switchTo: "English",

    badge: "Chụp một lần · đủ mọi cỡ",
    h1Pre: "Ảnh thẻ ",
    h1Mark: "đúng chuẩn",
    h1Post: ", chụp bằng điện thoại",
    heroBody:
      " tỉ lệ đầu, đường mắt và màu nền của tấm ảnh bạn sắp nộp — rồi cắt đúng từng pixel và DPI cho từng loại giấy tờ.",
    heroBodyStrong: "đo",
    ctaTry: "Làm thử miễn phí →",
    ctaNote: "Không cần đăng ký · xong trong 2 phút",

    whyTitle: "Chỗ khác biệt nằm ở thứ bạn không nhìn thấy",
    whyBody:
      "Ảnh bị trả ở quầy hầu như không bao giờ vì “xấu”. Nó bị trả vì đầu to hơn 2 milimét, vì đường mắt lệch, vì nền không phải màu quy định. Đó là những con số — nên chúng tôi đo chúng, không đoán.",
    cards: [
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
    ],

    flow1Tag: "Luồng 1",
    flow1Title: "Ảnh thẻ đúng chuẩn",
    flow1Body:
      "Chọn loại giấy tờ, chụp một lần. AI chấm 8 tiêu chuẩn, thay nền đúng màu quy định, rồi xuất đủ mọi cỡ bạn cần kèm bản in ghép 10×15 có dấu cắt.",
    flow2Tag: "Luồng 2 ✨",
    flow2Title: "Studio sáng tạo",
    flow2Body:
      "AI vẽ lại bạn theo phong cách bạn chọn — doanh nhân, áo dài, glamour, cổ trang. Xem xong dặn AI chỉnh tiếp tới khi ưng. Khuôn mặt giữ nguyên là bạn.",

    priceTitle: "Giá",
    priceBody:
      "Trả theo lần dùng. Không gói tháng — vì ảnh thẻ không phải thứ cần mỗi tháng.",
    priceBadge: "Hay chọn nhất",
    priceNote:
      "Thanh toán chưa mở — bản đang chạy cho dùng thử miễn phí trong hạn mức ngày.",

    endTitle: "Thử một tấm xem sao",
    endBody: "Không cần tài khoản. Ưng rồi mới tính chuyện đăng nhập.",
    endCta: "Bắt đầu →",

    footer: "Ảnh sáng tạo do AI vẽ lại — không dùng làm giấy tờ tuỳ thân.",
  },

  en: {
    metaTitle: "Ảnh thẻ Studio — compliant ID photos and AI portraits",
    metaDescription:
      "Shoot on your phone. AI checks 8 requirements, replaces the background and exports every size at exact px/DPI with a print sheet. Or let AI repaint you as an executive, in áo dài, or glamour.",

    navApp: "Open the app",
    switchTo: "Tiếng Việt",

    badge: "Shoot once · every size",
    h1Pre: "",
    h1Mark: "Compliant",
    h1Post: " ID photos, shot on your phone",
    heroBody:
      " the head ratio, eye line and background colour of the photo you are about to submit — then crops it to the exact pixel and DPI each document requires.",
    heroBodyStrong: "measures",
    ctaTry: "Try it free →",
    ctaNote: "No signup · done in 2 minutes",

    whyTitle: "The difference is in what you never see",
    whyBody:
      "Photos are almost never rejected at the counter for being “ugly”. They are rejected because the head is 2 millimetres too tall, because the eye line sits wrong, because the background is not the required colour. Those are numbers — so we measure them instead of guessing.",
    cards: [
      {
        t: "Measured, not guessed",
        d: "Head ratio, eye line, crop box, px and DPI are all computed arithmetically and cut by machine — never decided by the AI.",
      },
      {
        t: "The AI gets audited",
        d: "After the AI replaces the background, the machine re-measures the colour of the finished file. The AI saying it is done does not make it done.",
      },
      {
        t: "ID photos stay untouched",
        d: "ID photos only get a new background and sharpening. Changing clothes or slimming a face edits an identity document — that lives in the portrait flow only.",
      },
    ],

    flow1Tag: "Flow 1",
    flow1Title: "Compliant ID photos",
    flow1Body:
      "Pick a document type, shoot once. The AI grades 8 requirements, replaces the background with the required colour, then exports every size you need plus a 10×15 print sheet with crop marks.",
    flow2Tag: "Flow 2 ✨",
    flow2Title: "Creative studio",
    flow2Body:
      "The AI repaints you in the style you pick — executive, áo dài, glamour, period costume. Then tell it what to change until you are happy. The face stays yours.",

    priceTitle: "Pricing",
    priceBody:
      "Pay per use. No monthly plan — an ID photo is not something you need every month.",
    priceBadge: "Most popular",
    priceNote:
      "Payments are not open yet — this build is free to try within a daily quota.",

    endTitle: "Try one and see",
    endBody: "No account needed. Sign in later, once you like the result.",
    endCta: "Get started →",

    footer: "Creative shots are AI-repainted — not valid as identity documents.",
  },
};
