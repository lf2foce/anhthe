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

/**
 * Địa chỉ công khai của site.
 *
 * BẮT BUỘC cho `metadataBase`: thiếu nó thì Next dựng URL ảnh chia sẻ dạng
 * tương đối, và Facebook/Zalo bỏ qua thẻ đó — link dán ra chỉ còn chữ. Đặt qua
 * env để bản preview không quảng cáo ảnh của bản prod.
 */
function resolveSiteUrl(): string {
  // `??` KHÔNG chặn chuỗi rỗng, mà biến để trống trong .env là chuyện thường —
  // và khi đó `new URL("")` ném lỗi làm GÃY CẢ BUILD với một câu không liên
  // quan ("Failed to collect configuration for /_not-found"). Đã dính đúng ca
  // này. Vì vậy coi rỗng/khoảng trắng là KHÔNG CÓ.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

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

  /** Khối trước/sau — bằng chứng mạnh nhất, đặt ngay sau hero */
  wowTag: string;
  wowTitle: string;
  wowBody: string;
  wowBefore: string;
  wowBeforeSub: string;
  wowAfter: string;
  wowAfterSub: string;
  wowSteps: ReadonlyArray<string>;
  wowFinePrint: string;

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

    wowTag: "Cùng một tấm ảnh",
    wowTitle: "Áo thun ở nhà, ra hồ sơ mặc vest",
    wowBody:
      "Không phải chọn bộ lọc. Máy đo tấm ảnh bạn vừa chụp, thay nền đúng màu quy định, mặc vest hoặc sơ mi lên, rồi cắt đúng khung chuẩn — trong một lượt.",
    wowBefore: "Ảnh bạn chụp",
    wowBeforeSub: "Điện thoại, áo thun, nền tường",
    wowAfter: "Ảnh thẻ 3×4",
    wowAfterSub: "354×472 px · 300dpi · đầu 70%",
    wowSteps: [
      "Nền về đúng màu quy định, đo lại bằng máy",
      "Vest hoặc sơ mi, chỉ từ đường cổ trở xuống",
      "Khung cắt đúng tỉ lệ đầu và đường mắt",
    ],
    wowFinePrint:
      "Khuôn mặt, tóc và biểu cảm giữ nguyên tuyệt đối. Thay trang phục chỉ có ở ảnh 3×4/4×6 dân dụng — visa, hộ chiếu và hồ sơ thi cấm chỉnh sửa nên chúng tôi khoá.",

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
        t: "Khuôn mặt là bất khả xâm phạm",
        d: "Không bao giờ làm thon mặt, đổi biểu cảm hay xoá nốt ruồi. Ảnh 3×4/4×6 được thay áo như ngoài tiệm; visa, hộ chiếu và hồ sơ thi thì khoá cả áo — nơi nhận cấm chỉnh sửa.",
      },
    ],

    flow1Tag: "Luồng 1",
    flow1Title: "Ảnh thẻ đúng chuẩn",
    flow1Body:
      "Chọn loại giấy tờ, chụp một lần. AI chấm 8 tiêu chuẩn, thay nền đúng màu quy định, mặc luôn vest hay sơ mi nếu bạn muốn, rồi xuất đủ mọi cỡ kèm bản in ghép 10×15 có dấu cắt.",
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

    wowTag: "One single photo",
    wowTitle: "A t-shirt at home, a suit on your file",
    wowBody:
      "No filter to pick. The machine measures the photo you just took, swaps the background to the required colour, puts you in a suit or shirt, then crops to the exact frame — in one pass.",
    wowBefore: "Your photo",
    wowBeforeSub: "Phone, t-shirt, a wall",
    wowAfter: "ID photo 3×4",
    wowAfterSub: "354×472 px · 300dpi · head 70%",
    wowSteps: [
      "Background set to the required colour, re-measured by machine",
      "Suit or shirt, from the neckline down only",
      "Cropped to the exact head ratio and eye line",
    ],
    wowFinePrint:
      "Face, hair and expression stay exactly as they were. Wardrobe swap is for civilian 3×4/4×6 photos only — visas, passports and exam files forbid retouching, so we lock it there.",

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
        t: "The face is off limits",
        d: "Never slims a face, changes an expression or removes a mole. Civilian 3×4/4×6 photos get a wardrobe swap like at a photo shop; visas, passports and exam files keep the clothes too — those authorities forbid retouching.",
      },
    ],

    flow1Tag: "Flow 1",
    flow1Title: "Compliant ID photos",
    flow1Body:
      "Pick a document type, shoot once. The AI grades 8 requirements, replaces the background with the required colour, puts you in a suit or shirt if you want, then exports every size plus a 10×15 print sheet with crop marks.",
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
