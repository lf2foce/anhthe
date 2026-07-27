# Ảnh thẻ Studio

Bản chạy thật của prototype `Anh The Studio v2 (offline).html` — giữ nguyên
luồng 6 màn và hệ thiết kế Organic, thay toàn bộ dữ liệu giả bằng camera thật,
model Gemini thật và file xuất thật.

## Luồng

| # | Màn | Việc thật xảy ra |
|---|-----|------------------|
| 1 | Trang chủ | Chọn nhiều loại giấy tờ (registry ở `src/lib/docs.ts`) |
| 2 | Chụp | `getUserMedia` + `<canvas>` → JPEG dựng sẵn, hoặc tải ảnh có sẵn |
| 3 | AI kiểm tra | `POST /api/check` — Gemini đo landmark + chấm 6 tiêu chí; 2 tiêu chí còn lại tính bằng số học |
| 4 | Chỉnh sửa | `POST /api/retouch` — Gemini thay nền, làm mịn da; độ sáng & tỉ lệ đầu là preview CSS |
| 5 | Xuất ảnh | `POST /api/export` — sharp crop/resize đúng px & DPI + ghép tờ in 10×15 |
| 6 | Hoàn tất | Tải từng file hoặc gộp `.zip` (jszip, nạp động ở client) |

## Ranh giới AI ↔ số học

Đây là quyết định kiến trúc chính, không phải chi tiết cài đặt:

- **AI làm** những việc chỉ nhìn mới biết: đo landmark (đỉnh đầu, cằm, mắt, trục
  mặt), chấm 6 tiêu chí quan sát, thay nền, làm mịn da.
- **Số học làm** mọi thứ quyết định đạt/không đạt: tỉ lệ đầu, đường mắt, khung
  crop, kích thước px, DPI, bố cục tờ in. Model sinh ảnh không đảm bảo được
  "đầu chiếm đúng 60% chiều cao ở 600×600 px", nên phần đó thuộc về
  `src/lib/geometry.ts` + `src/lib/render.ts` và có test.

Hệ quả quan trọng: sau khi Gemini thay nền, `/api/retouch` **đo lại landmark
trên chính ảnh vừa sinh**. Dùng lại landmark của ảnh gốc là cách chắc chắn nhất
để cắt trượt đầu, vì model có thể xê dịch khung vài phần trăm.

## Model

| Việc | Model | Đổi bằng |
|------|-------|----------|
| Thay nền, retouch | `gemini-3.1-flash-lite-image` | `GEMINI_IMAGE_MODEL` |
| Đo landmark, chấm tiêu chí | `gemini-3.5-flash-lite` | `GEMINI_TEXT_MODEL` |

Bản `-lite-image` chỉ xuất được 1K. Với ảnh in khổ lớn, đổi sang
`gemini-3.1-flash-image` kèm `GEMINI_IMAGE_SIZE=2K`. Khi khung crop nhỏ hơn
kích thước đích, file xuất ra được đánh dấu `upscaled` và màn Hoàn tất nói thẳng
là ảnh đã bị phóng to.

## Chạy

```bash
cp .env.example .env.local   # điền GEMINI_API_KEY
npm run dev
```

Camera cần HTTPS hoặc `localhost`. Nút "Dùng ảnh có sẵn trong máy" chạy được ở
mọi nơi.

```bash
npm test        # geometry + render (không gọi mạng)
npm run build
```

## Spec giấy tờ chưa verify

`src/lib/docs.ts` đánh dấu `verified: false` cho những spec **chưa** đối chiếu
văn bản gốc (Schengen, 3×4, 4×6, thi cử). Các con số đó đang lấy theo thông lệ.
Trước khi mở bán loại giấy tờ nào thì phải verify `headRatio` / `eyeFromBottom`
của loại đó với nguồn chính thức — sai một con số là ảnh bị từ chối ở quầy. UI
đang hiện nhãn cảnh báo ở màn Xuất ảnh.
