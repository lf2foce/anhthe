/** Nội dung song ngữ — lấy nguyên văn từ prototype v2, bổ sung phần cần cho bản chạy thật. */

export type Lang = "vi" | "en";

export interface Copy {
  brand: string;
  tagline: string;

  homeKicker: string;
  homeTitle: string;
  homeSub: string;
  pickTitle: string;
  pickHint: string;
  ctaShoot: string;
  ctaUpload: string;
  pickNone: string;

  capTitle: string;
  tips: readonly string[];
  shutterHint: string;
  camDenied: string;
  camStarting: string;
  useUpload: string;
  retakeShort: string;
  useThis: string;

  checkTitle: string;
  scanning: string;
  criteria: string;
  steps: readonly string[];
  verdictPass: string;
  verdictFixable: string;
  verdictFail: string;
  verdictSubPass: string;
  verdictSubFixable: string;
  verdictSubFail: string;
  fixCta: string;
  retake: string;
  checkFailed: string;

  editTitle: string;
  bgLabel: string;
  bright: string;
  headRatio: string;
  smooth: string;
  crownLine: string;
  editNote: string;
  editCta: string;
  applying: string;
  applyBg: string;
  bgDone: string;
  previewOf: string;

  exportTitle: string;
  exportSub: string;
  sheetTitle: string;
  sheetSub: string;
  exporting: string;

  doneTitle: string;
  doneSub: string;
  saved: string;
  download: string;
  downloadOne: string;
  again: string;

  rail: readonly string[];
  back: string;
  unverified: string;
}

export const COPY: Record<Lang, Copy> = {
  vi: {
    brand: "Phòng tối",
    tagline:
      "Chọn nhiều loại giấy tờ, chụp một lần, AI kiểm tra tiêu chuẩn rồi xuất đủ kích cỡ.",

    homeKicker: "Chụp một lần · đủ mọi cỡ",
    homeTitle: "Ảnh thẻ đúng chuẩn, chụp ngay tại nhà",
    homeSub:
      "Bạn chỉ cần một bức tường sáng màu và ánh sáng cửa sổ. Phần quy định để chúng tôi lo.",
    pickTitle: "Bạn cần ảnh cho việc gì?",
    pickHint: "Chọn nhiều loại được",
    ctaShoot: "Bắt đầu chụp",
    ctaUpload: "Dùng ảnh có sẵn trong máy",
    pickNone: "Chọn ít nhất một loại giấy tờ",

    capTitle: "Canh khuôn mặt vào khung",
    tips: [
      "Đứng cách tường trắng khoảng 50cm",
      "Ánh sáng chiếu từ phía trước mặt",
      "Bỏ kính, tóc không che tai",
    ],
    shutterHint: "Bấm nút tròn để chụp",
    camDenied:
      "Không mở được camera. Bạn có thể tải ảnh có sẵn lên thay thế.",
    camStarting: "Đang mở camera…",
    useUpload: "Tải ảnh lên",
    retakeShort: "Chụp lại",
    useThis: "Dùng ảnh này",

    checkTitle: "AI kiểm tra",
    scanning: "Đang kiểm tra 8 tiêu chí…",
    criteria: "tiêu chí",
    steps: ["Đo khuôn mặt", "Kiểm tra nền", "Đo tỉ lệ đầu", "Kiểm tra ánh sáng"],
    verdictPass: "Đạt chuẩn",
    verdictFixable: "Đạt chuẩn sau khi sửa nền",
    verdictFail: "Cần chụp lại",
    verdictSubPass: "Cả 8 tiêu chí đều đạt — sang bước chỉnh sửa là xuất được.",
    verdictSubFixable: "Vài tiêu chí cần chỉnh — app sửa tự động ở bước sau.",
    verdictSubFail: "Có lỗi app không sửa được bằng phần mềm. Chụp lại giúp nhé.",
    fixCta: "Sửa & tiếp tục",
    retake: "Chụp lại",
    checkFailed: "Không kiểm tra được ảnh",

    editTitle: "Chỉnh sửa",
    bgLabel: "Nền ảnh",
    bright: "Độ sáng",
    headRatio: "Tỉ lệ đầu",
    smooth: "Làm mịn da nhẹ (giữ nét tự nhiên)",
    crownLine: "đỉnh đầu",
    editNote:
      "Mọi chỉnh sửa đều nằm trong giới hạn cho phép của từng loại giấy tờ.",
    editCta: "Xem bản xuất",
    applying: "AI đang thay nền…",
    applyBg: "Thay nền bằng AI",
    bgDone: "Đã thay nền",
    previewOf: "Xem trước theo",

    exportTitle: "Xuất ảnh",
    exportSub: "Cùng một bức ảnh, cắt đúng tỉ lệ cho từng loại giấy tờ.",
    sheetTitle: "Bản in ghép 10×15 cm",
    sheetSub: "Xếp kín một tờ — mang ra tiệm in",
    exporting: "Đang dựng file…",

    doneTitle: "Xong rồi!",
    doneSub: "Tải về máy hoặc gửi thẳng vào hồ sơ. Bản in ghép đã sẵn sàng.",
    saved: "Sẵn sàng",
    download: "Tải tất cả (.zip)",
    downloadOne: "Tải",
    again: "Chụp bộ ảnh khác",

    rail: ["Trang chủ", "Chụp", "AI kiểm tra", "Chỉnh sửa", "Xuất ảnh", "Hoàn tất"],
    back: "Quay lại",
    unverified: "Spec chưa đối chiếu văn bản gốc",
  },

  en: {
    brand: "Darkroom",
    tagline:
      "Pick several document types, shoot once, let the AI check the rules, export every size.",

    homeKicker: "Shoot once · every size",
    homeTitle: "Compliant ID photos, taken at home",
    homeSub:
      "All you need is a light wall and window light. We will handle the regulations.",
    pickTitle: "What do you need photos for?",
    pickHint: "Pick as many as you like",
    ctaShoot: "Start shooting",
    ctaUpload: "Use a photo from my library",
    pickNone: "Pick at least one document type",

    capTitle: "Line your face up",
    tips: [
      "Stand about 50cm from a white wall",
      "Let the light fall on your face",
      "No glasses, keep ears visible",
    ],
    shutterHint: "Tap the round button to shoot",
    camDenied: "Could not open the camera. You can upload a photo instead.",
    camStarting: "Opening camera…",
    useUpload: "Upload a photo",
    retakeShort: "Retake",
    useThis: "Use this photo",

    checkTitle: "AI check",
    scanning: "Checking 8 requirements…",
    criteria: "requirements",
    steps: [
      "Measuring face",
      "Checking background",
      "Measuring head size",
      "Checking light",
    ],
    verdictPass: "Compliant",
    verdictFixable: "Compliant once the background is fixed",
    verdictFail: "Needs a retake",
    verdictSubPass: "All 8 requirements pass — retouch and export.",
    verdictSubFixable: "A few items need work — fixed automatically next step.",
    verdictSubFail: "Software cannot fix these. Please shoot again.",
    fixCta: "Fix & continue",
    retake: "Retake",
    checkFailed: "Could not check the photo",

    editTitle: "Retouch",
    bgLabel: "Background",
    bright: "Brightness",
    headRatio: "Head size",
    smooth: "Light skin smoothing (keeps texture)",
    crownLine: "crown",
    editNote:
      "Every adjustment stays inside the limits of each document type.",
    editCta: "See the exports",
    applying: "AI is replacing the background…",
    applyBg: "Replace background with AI",
    bgDone: "Background replaced",
    previewOf: "Preview for",

    exportTitle: "Export",
    exportSub: "One photo, cropped to the right ratio for each document.",
    sheetTitle: "Print sheet 10×15 cm",
    sheetSub: "A full sheet — print it at any shop",
    exporting: "Building files…",

    doneTitle: "All done!",
    doneSub: "Download them or send them straight with your application.",
    saved: "Ready",
    download: "Download all (.zip)",
    downloadOne: "Get",
    again: "Shoot another set",

    rail: ["Home", "Capture", "AI check", "Retouch", "Export", "Done"],
    back: "Back",
    unverified: "Spec not yet checked against the official text",
  },
};

/** Nhãn 8 tiêu chí — id khớp với `CheckId` ở lib/checks.ts */
export const CHECK_LABELS: Record<string, { vi: string; en: string }> = {
  face_front: { vi: "Khuôn mặt chính diện", en: "Face square to camera" },
  eyes_open: { vi: "Mắt mở rõ, không phản quang", en: "Eyes open, no glare" },
  neutral_expression: { vi: "Biểu cảm trung tính", en: "Neutral expression" },
  background_even: {
    vi: "Nền đều màu, không bóng",
    en: "Even, shadow-free background",
  },
  lighting_even: { vi: "Ánh sáng đều hai bên", en: "Even light on both sides" },
  no_hat_no_glasses: { vi: "Không mũ, không kính", en: "No hat, no glasses" },
  head_ratio: { vi: "Tỉ lệ đầu", en: "Head size" },
  resolution: { vi: "Độ phân giải", en: "Resolution" },
};
