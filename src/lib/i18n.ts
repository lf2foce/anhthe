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
  /** Nhắc ở trang chủ: các cỡ khác thêm sau khi đã ưng ảnh */
  moreSizesLater: string;
  ctaShoot: string;
  ctaUpload: string;

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

  /** Hậu tố cho tiêu chí không bắt buộc với tập giấy tờ đang chọn */
  notRequired: string;

  editTitle: string;
  bgLabel: string;
  /** Giải thích vì sao có nền không bấm được */
  bgRule: string;
  bright: string;
  headRatio: string;
  smooth: string;
  sharpen: string;
  sharpenSub: string;
  crownLine: string;
  eyeLine: string;
  /** Bước xử lý ảnh — đặt tên theo KẾT QUẢ, không theo cơ chế */
  improveTitle: string;
  improveSteps: readonly string[];
  improveCta: string;
  editNote: string;
  editCta: string;
  applying: string;
  applyBg: string;
  bgDone: string;
  /** Model trả ảnh về nhưng đo ra nền vẫn chưa đổi */
  bgNotApplied: string;
  bgRetry: string;

  exportTitle: string;
  exportSub: string;
  /** Nhãn cạnh loại chính ở màn Xuất ảnh */
  primaryTag: string;
  stillFailing: string;
  /** Loại mới tick đòi màu nền khác */
  needMoreBg: string;
  lowRes: string;
  sheetTitle: string;
  sheetSub: string;
  exporting: string;

  doneTitle: string;
  doneSub: string;
  download: string;
  downloadOne: string;
  again: string;

  rail: readonly string[];
  back: string;
  unverified: string;

  /** Studio sáng tạo — luồng thứ hai, tách hẳn luồng ảnh thẻ */
  flowCreativeTitle: string;
  flowCreativeSub: string;
  packsSub: string;
  /** Nhắc là ảnh cũ vẫn dùng được khi đổi phong cách */
  packsReuse: string;
  generating: string;
  moreShots: string;
  changeStyle: string;
  newPhoto: string;
  creativeNote: string;

  /** Bước tuỳ chỉnh trước khi tạo + vòng tinh chỉnh sau khi tạo */
  notePlaceholder: string;
  aspectLabel: string;
  countLabel: string;
  qualityHigh: string;
  qualityHighSub: string;
  optionsLabel: string;
  refineGo: string;
  upscale2k: string;
  refining: string;
}

export const COPY: Record<Lang, Copy> = {
  vi: {
    brand: "Phòng tối",
    tagline:
      "Chụp một lần cho loại bạn cần, AI kiểm tra tiêu chuẩn, ưng rồi xuất sang mọi cỡ khác.",

    homeKicker: "Chụp một lần · đủ mọi cỡ",
    homeTitle: "Ảnh thẻ đúng chuẩn, chụp ngay tại nhà",
    homeSub:
      "Bạn chỉ cần một bức tường sáng màu và ánh sáng cửa sổ. Phần quy định để chúng tôi lo.",
    pickTitle: "Bạn cần ảnh cho việc gì?",
    pickHint: "Chọn một loại để canh",
    moreSizesLater:
      "Chụp và canh cho loại này trước. Ưng rồi thì thêm các cỡ khác ở bước xuất ảnh.",
    ctaShoot: "Bắt đầu chụp",
    ctaUpload: "Dùng ảnh có sẵn trong máy",

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
    scanning: "Đang kiểm tra tiêu chuẩn ảnh…",
    steps: ["Đo khuôn mặt", "Kiểm tra nền", "Đo tỉ lệ đầu", "Kiểm tra ánh sáng"],
    verdictPass: "Đạt chuẩn",
    verdictFixable: "Đạt chuẩn sau khi sửa nền",
    verdictFail: "Cần chụp lại",
    verdictSubPass: "Cả {n} tiêu chí bắt buộc đều đạt — sang bước chỉnh sửa là xuất được.",
    verdictSubFixable: "Vài tiêu chí cần chỉnh — app sửa tự động ở bước sau.",
    verdictSubFail: "Có lỗi app không sửa được bằng phần mềm. Chụp lại giúp nhé.",
    fixCta: "Sửa & tiếp tục",
    retake: "Chụp lại",
    checkFailed: "Không kiểm tra được ảnh",
    notRequired: "· không bắt buộc cho lựa chọn này",

    editTitle: "Chỉnh sửa",
    bgLabel: "Nền ảnh",
    bgRule:
      "Nền do chuẩn của từng loại giấy tờ quyết định. Bạn chỉ đổi được trong phạm vi loại đó cho phép.",
    bright: "Độ sáng",
    headRatio: "Tỉ lệ đầu",
    smooth: "Làm mịn da nhẹ (giữ nét tự nhiên)",
    sharpen: "Làm nét ảnh",
    sharpenSub: "Tăng nét chi tiết đang có — không bịa thêm chi tiết mặt",
    crownLine: "đầu",
    eyeLine: "mắt",
    improveTitle: "Chuẩn hoá ảnh",
    improveSteps: [
      "Thay nền đúng màu quy định",
      "Canh khung vào đúng tỉ lệ chuẩn",
      "Cân sáng và làm mịn nhẹ",
    ],
    improveCta: "Chuẩn hoá ảnh",
    editNote:
      "Mọi chỉnh sửa đều nằm trong giới hạn cho phép của từng loại giấy tờ.",
    editCta: "Xem bản xuất",
    applying: "AI đang thay nền…",
    applyBg: "Thay nền bằng AI",
    bgDone: "Đã thay nền",
    bgNotApplied:
      "AI chưa đổi được nền — nền trong ảnh vẫn không đúng màu chuẩn. Thử lại, hoặc chụp trước một bức tường trơn.",
    bgRetry: "Thử thay nền lại",

    exportTitle: "Xuất ảnh",
    exportSub:
      "Thêm cỡ nào cũng được — cùng bức ảnh vừa ưng, cắt đúng tỉ lệ cho từng loại.",
    primaryTag: "đã canh",
    stillFailing: "Chưa đạt từ bước kiểm tra, không liên quan loại vừa thêm:",
    needMoreBg:
      "Loại vừa thêm cần màu nền khác — phải thay nền thêm một lần cho màu đó.",
    lowRes: "Thiếu điểm ảnh — file sẽ bị phóng to và mềm nét",
    sheetTitle: "Bản in ghép 10×15 cm",
    sheetSub: "Xếp kín một tờ — mang ra tiệm in",
    exporting: "Đang dựng file…",

    doneTitle: "Xong rồi!",
    doneSub: "Tải về máy hoặc gửi thẳng vào hồ sơ. Bản in ghép đã sẵn sàng.",
    download: "Tải tất cả (.zip)",
    downloadOne: "Tải",
    again: "Chụp bộ ảnh khác",

    rail: ["Trang chủ", "Chụp", "AI kiểm tra", "Chỉnh sửa", "Xuất ảnh", "Hoàn tất"],
    back: "Quay lại",
    unverified: "Spec chưa đối chiếu văn bản gốc",

    flowCreativeTitle: "Studio sáng tạo",
    flowCreativeSub: "Doanh nhân, áo dài, glamour, cổ trang…",
    packsSub: "Chọn một phong cách là tạo ngay. Xem xong dặn AI chỉnh tiếp tới khi ưng.",
    packsReuse: "Ảnh bạn vừa dùng vẫn còn — chọn phong cách khác là tạo được ngay.",
    generating: "AI đang vẽ…",
    moreShots: "Tạo thêm",
    changeStyle: "Đổi phong cách",
    newPhoto: "Dùng ảnh khác",
    creativeNote:
      "Ảnh sáng tạo do AI vẽ lại toàn bộ — không dùng làm giấy tờ tuỳ thân. Cần ảnh thẻ chuẩn thì quay về luồng Ảnh thẻ.",

    notePlaceholder: "Dặn AI: nền tối hơn, cười tươi hơn, tóc búi cao…",
    aspectLabel: "Khung",
    countLabel: "Số ảnh",
    qualityHigh: "Chất lượng cao 2K",
    qualityHighSub: "Nét hơn cho in lớn — chậm và tốn hơn",
    optionsLabel: "Tuỳ chọn nâng cao",
    refineGo: "Vẽ lại ảnh này",
    upscale2k: "Nâng 2K",
    refining: "Đang vẽ lại…",
  },

  en: {
    brand: "Darkroom",
    tagline:
      "Shoot once for the type you need, let the AI check the rules, then export every other size.",

    homeKicker: "Shoot once · every size",
    homeTitle: "Compliant ID photos, taken at home",
    homeSub:
      "All you need is a light wall and window light. We will handle the regulations.",
    pickTitle: "What do you need photos for?",
    pickHint: "Pick one to frame for",
    moreSizesLater:
      "Shoot and frame for this one first. Once you like it, add other sizes at the export step.",
    ctaShoot: "Start shooting",
    ctaUpload: "Use a photo from my library",

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
    scanning: "Checking photo requirements…",
    steps: [
      "Measuring face",
      "Checking background",
      "Measuring head size",
      "Checking light",
    ],
    verdictPass: "Compliant",
    verdictFixable: "Compliant once the background is fixed",
    verdictFail: "Needs a retake",
    verdictSubPass: "All {n} required items pass — retouch and export.",
    verdictSubFixable: "A few items need work — fixed automatically next step.",
    verdictSubFail: "Software cannot fix these. Please shoot again.",
    fixCta: "Fix & continue",
    retake: "Retake",
    checkFailed: "Could not check the photo",
    notRequired: "· not required for this selection",

    editTitle: "Retouch",
    bgLabel: "Background",
    bgRule:
      "Each document type dictates its background. You can only change it within what that type allows.",
    bright: "Brightness",
    headRatio: "Head size",
    smooth: "Light skin smoothing (keeps texture)",
    sharpen: "Sharpen",
    sharpenSub: "Boosts detail that is already there — invents nothing",
    crownLine: "head",
    eyeLine: "eyes",
    improveTitle: "Make it compliant",
    improveSteps: [
      "Replace the background with the required colour",
      "Fit the crop to the exact required ratio",
      "Even out the light, light skin smoothing",
    ],
    improveCta: "Make it compliant",
    editNote:
      "Every adjustment stays inside the limits of each document type.",
    editCta: "See the exports",
    applying: "AI is replacing the background…",
    applyBg: "Replace background with AI",
    bgDone: "Background replaced",
    bgNotApplied:
      "The AI did not replace the background — it still is not the required colour. Try again, or shoot against a plain wall.",
    bgRetry: "Try replacing again",

    exportTitle: "Export",
    exportSub:
      "Add any size — the same photo you just approved, cropped per document.",
    primaryTag: "framed",
    stillFailing: "Already failing since the check step, unrelated to what you added:",
    needMoreBg:
      "The type you just added needs a different background — one more replacement pass for that colour.",
    lowRes: "Not enough pixels — this file will be upscaled and look soft",
    sheetTitle: "Print sheet 10×15 cm",
    sheetSub: "A full sheet — print it at any shop",
    exporting: "Building files…",

    doneTitle: "All done!",
    doneSub: "Download them or send them straight with your application.",
    download: "Download all (.zip)",
    downloadOne: "Get",
    again: "Shoot another set",

    rail: ["Home", "Capture", "AI check", "Retouch", "Export", "Done"],
    back: "Back",
    unverified: "Spec not yet checked against the official text",

    flowCreativeTitle: "Creative studio",
    flowCreativeSub: "Professional, áo dài, glamour, period costume…",
    packsSub: "Pick a style and it generates right away. Then tell the AI what to tweak until you love it.",
    packsReuse: "Your last photo is still loaded — pick another style to generate right away.",
    generating: "AI is drawing…",
    moreShots: "More shots",
    changeStyle: "Change style",
    newPhoto: "Use another photo",
    creativeNote:
      "Creative images are fully AI-redrawn — never valid for identity documents. Need a compliant photo? Use the ID flow.",

    notePlaceholder: "Tell the AI: darker backdrop, bigger smile, hair up…",
    aspectLabel: "Frame",
    countLabel: "Shots",
    qualityHigh: "High quality 2K",
    qualityHighSub: "Sharper for large prints — slower and pricier",
    optionsLabel: "Advanced options",
    refineGo: "Redraw this shot",
    upscale2k: "Up to 2K",
    refining: "Redrawing…",
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
  // Tiêu chí này gộp ba thứ computeCrop báo về: khung có đủ khoảng trống quanh
  // đầu, tỉ lệ đầu, và đường mắt. Nhãn "Tỉ lệ đầu" làm người dùng đọc chi tiết
  // "đường mắt 54% ngoài chuẩn" mà không hiểu sao lại nằm dưới tỉ lệ đầu.
  head_ratio: {
    vi: "Khung ảnh: tỉ lệ đầu & đường mắt",
    en: "Framing: head size & eye line",
  },
  resolution: { vi: "Độ phân giải", en: "Resolution" },
};
