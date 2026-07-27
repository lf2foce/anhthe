# Ảnh thẻ Studio

Bản chạy thật của prototype `Anh The Studio v2 (offline).html` — giữ nguyên
luồng 6 màn và hệ thiết kế Organic, thay toàn bộ dữ liệu giả bằng camera thật,
model Gemini thật và file xuất thật.

## Hai luồng

Chọn luồng TRƯỚC mọi thứ khác — chúng khác nhau ở chỗ căn bản, không phải mức độ:

| Luồng | Là gì | AI được làm gì |
|---|---|---|
| **Ảnh thẻ** | 6 màn compliance: chụp → chấm → thay nền → xuất đúng px/DPI | Chỉ quan sát + thay nền. Mọi phép sửa khác là số học (crop, nới khung, làm nét tích chập) |
| **Studio sáng tạo** | Chọn phong cách (doanh nhân, áo dài, glamour, cổ trang…) → AI vẽ lại toàn bộ → tải về | Vẽ lại TẤT CẢ — trang phục, bối cảnh, ánh sáng. Sàn duy nhất: vẫn phải là NGƯỜI ĐÓ |

Studio sáng tạo (`src/lib/packs.ts`, `/api/generate`, `/api/refine`,
`CreativeStudio.tsx`) không có compliance, không landmark, không crop — cố tình.
Nguyên tắc UX: **tạo trước, chỉnh sau**. Bấm phong cách là tạo ngay với mặc định của
pack — không có form chắn giữa người dùng và phần thưởng. Màn kết quả là trung tâm:
ảnh to + dải thumbnail, MỘT ô "dặn AI" dùng cho cả **vẽ lại ảnh đang chọn** lẫn
**tạo lô mới**, tuỳ chọn nâng cao (khung 1:1→9:16, 2K, số ảnh) gập lại phía dưới.
Mỗi vòng vẽ lại là một lần gọi `/api/refine` lấy chính ảnh kết quả làm đầu vào.

`IDENTITY_FLOOR` trong packs.ts đi vào mọi prompt — kể cả prompt tinh chỉnh — và có
test canh từng dòng; ghi chú người dùng chèn TRƯỚC khối ràng buộc nên sàn luôn thắng
khi mâu thuẫn, và bị cắt ở `MAX_NOTE_LENGTH` ở cả client lẫn server. Mỗi biến thể một
gợi ý góc máy riêng để hai lần gọi không ra hai ảnh y hệt. Ảnh sáng tạo không bao giờ
dùng làm giấy tờ — hai luồng không chung state, không chung route.

Ảnh mẫu gallery (`public/packs/`) là người mẫu **hư cấu do AI tạo**, sinh bằng
`gen-thumbs.mjs` (một lần, bằng key thật): tạo một chân dung hư cấu rồi chạy qua đúng
scene của từng pack — mọi tile cùng một người. Đổi scene thì chạy lại script.

Registry vẫn giữ `family` + `sanitizeRetouch` ở server như một chốt cũ của `/api/retouch`
(client gửi cờ gì cũng không mở được đổi-áo cho ảnh giấy tờ), dù UI docs-portrait đã
nhường chỗ cho Studio sáng tạo.

## Luồng

Chốt MỘT ảnh trước, rồi mới đẩy sang các cỡ khác. Chọn nhiều loại ngay từ đầu
nghe tiện hơn nhưng sai: mỗi loại có target tỉ lệ đầu riêng, nên một thanh trượt
dùng chung sẽ âm thầm đổi cả những loại người dùng không xem tới.

| # | Màn | Việc thật xảy ra |
|---|-----|------------------|
| 1 | Trang chủ | Chọn chế độ, rồi chọn **một** loại chính (`primary`) — loại tấm ảnh được chụp và canh cho |
| 2 | Chụp | `getUserMedia` + `<canvas>` → JPEG dựng sẵn, hoặc tải ảnh có sẵn |
| 3 | AI kiểm tra | `POST /api/check` — Gemini đo landmark + chấm 6 tiêu chí. Route **không** trả kết luận nào |
| 4 | Chỉnh sửa | `POST /api/retouch` — Gemini thay nền, làm mịn da; canh tỉ lệ đầu cho **riêng** loại chính |
| 5 | Xuất ảnh | Tick thêm cỡ khác ở đây → `POST /api/export`, sharp crop/resize đúng px & DPI + ghép tờ in 10×15 |
| 6 | Hoàn tất | Tải từng file hoặc gộp `.zip` (jszip, nạp động ở client) |

`primary` luôn nằm trong `picked` và không bỏ tick được. `headScales` là map
`docId → hệ số`, không phải một số dùng chung. Chế độ **không** lưu riêng: nó là
`familyOf(primary)`, vì hai nguồn sự thật cho cùng một thứ là chỗ sinh trạng thái vô
nghĩa (chế độ "giấy tờ" mà loại chính là LinkedIn).

## Ranh giới AI ↔ số học

Đây là quyết định kiến trúc chính, không phải chi tiết cài đặt:

- **AI làm** những việc chỉ nhìn mới biết: đo landmark (đỉnh đầu, cằm, mắt, trục
  mặt), chấm 6 tiêu chí quan sát, thay nền, làm mịn da.
- **Số học làm** mọi thứ quyết định đạt/không đạt: tỉ lệ đầu, đường mắt, khung
  crop, kích thước px, DPI, bố cục tờ in. Model sinh ảnh không đảm bảo được
  "đầu chiếm đúng 60% chiều cao ở 600×600 px", nên phần đó thuộc về
  `src/lib/geometry.ts` + `src/lib/render.ts` và có test.

`/api/check` **chỉ trả quan sát** — 4 landmark + 6 tiêu chí, không có kết luận
đạt/trượt nào, và cố ý không nhận `docIds`. Kết luận tính ở client bằng
`evaluate()` (`src/lib/checks.ts`), thuần hàm. Nhờ vậy tick thêm một cỡ ở màn Xuất
ảnh là kết luận siết/nới lại tức thì — nếu bake kết luận ở server thì mỗi lần tick
là một lần gọi model, và cùng một tấm ảnh sẽ cho hai quan sát khác nhau chỉ vì
người dùng bấm khác. Đây là chỗ chặn cái bẫy "chấm ảnh cho LinkedIn (được cười)
rồi thêm visa Mỹ vào mà không ai kiểm lại".

Hệ quả quan trọng: sau khi Gemini thay nền, `/api/retouch` **đo lại landmark
trên chính ảnh vừa sinh**. Dùng lại landmark của ảnh gốc là cách chắc chắn nhất
để cắt trượt đầu, vì model có thể xê dịch khung vài phần trăm.

Hệ quả thứ hai: model được *yêu cầu* thay nền sang đúng hex, nhưng đó là yêu cầu
chứ không phải bảo đảm — nó có thể trả về ảnh gần như nguyên bản mà vẫn "thành
công", hoặc chỉ đổi nền quanh đầu rồi bỏ sót hai bên. `backgroundDeviation` ở
`src/lib/render.ts` **đo lại màu nền** ở cả hai chỗ: trong `/api/retouch` (để UI
không hiện dấu tích xanh khi nền chưa đổi) và trong `/api/export` (để file ra kèm
cảnh báo). Tiêu chí `background_even` của model chỉ nói nền có ĐỀU không, không nói
nền có ĐÚNG MÀU không — hai câu hỏi khác nhau.

Vùng đo là hai **dải dọc** sát mép trái/phải, từ đỉnh ảnh xuống tới đường cằm
(`chinFraction` lấy từ landmark). Bản đầu chỉ đo hai ô vuông ở góc trên và **bỏ lọt
đúng ca hay gặp nhất**: model làm trắng quanh đầu, để nguyên nền cũ ở hai bên tầm
vai. Giới hạn còn lại: nền sai ở phần dưới cằm thì không thấy, vì vùng đó không phân
biệt được với áo. Cả hai điều này có test.

## Nới khung: sửa "chụp quá sát" bằng số học, không nhờ model dịch người

Lỗi "ảnh gốc quá sát khuôn mặt" / "đường mắt ngoài chuẩn" KHÔNG sửa bằng cách bảo
model xê dịch người trong khung — đó là bắt nó vẽ lại chủ thể. `extendToFit`
(geometry.ts) tính đúng khoảng nền cần THÊM quanh ảnh cho mọi spec đã chọn, landmark
mới suy ra bằng phép dịch; `sharpExtend` (render.ts) lấp phần thêm bằng đúng màu nền
chuẩn. Chỉ nới khi nền đã đo được là đúng màu — nền rối thì giữ nguyên cảnh báo,
không nới bừa (chỗ nới sẽ lộ đường ghép).

Bốn nơi kể cùng một câu chuyện: `evaluate` (dự đoán), `CropPreview` (phần thò ra
ngoài ảnh hiện đúng màu nền container), màn Chỉnh sửa, và `/api/export` (sharp thật).
Một điều đã kiểm bằng đại số + test: nới khung KHÔNG làm ảnh thiếu pixel thành đủ
pixel — sau khi nới, đo độ phân giải theo khung crop tương đương đo theo đầu.

## Làm nét: tích chập, không phải AI

`sharpen` ở `renderSingle` là unsharp mask. Upscale sinh ảnh "làm nét" bằng cách
**bịa thêm** chi tiết mặt — lỗ chân lông, lông mi, gọng kính nó tưởng là có. Trên
ảnh giấy tờ tuỳ thân đó là sửa nội dung ảnh nhận dạng. Tích chập chỉ tăng tương phản
trên chi tiết đang có, xác định, và có test chứng minh nó không đổi px/DPI.

`retouchPrompt` được xuất ra để test được: hai chế độ khác nhau ở chỗ căn bản chứ
không phải mức độ, và đây là chỗ dễ nhất để một dòng cấm rơi mất mà không ai biết.
`gemini.test.ts` cố định cả hai chiều — ảnh giấy tờ không bao giờ có chữ "vest" trong
prompt, và ảnh chân dung dù mở tới đâu vẫn giữ sàn "không thành người khác, không xoá
nốt ruồi, không thon mặt".

## Chọn nhiều loại giấy tờ: cái gì share được, cái gì không

Ba trục ràng buộc, và chúng **không** xếp hạng giống nhau — nên không có loại nào
"khắt khe nhất" để chỉ cần đạt nó là đạt hết:

- **Hình học — share được.** Mỗi spec tự cắt khung riêng từ cùng một ảnh, nên
  visa Mỹ (đầu 60%) và Schengen (75%) cùng lấy được từ một lần chụp. Ràng buộc
  thật là ảnh nguồn phải đủ rộng cho spec cần khung to nhất, và đủ pixel cho spec
  cần đầu nhiều pixel nhất — hai spec khác nhau: Schengen dễ nhất về khung nhưng
  đòi nhiều pixel hơn visa Mỹ. Test ở `docs.test.ts` đóng băng chuyện này.
- **Nền — KHÔNG share được.** Một tấm ảnh chỉ có một màu nền. `groupByBackground`
  gom giấy tờ theo nền đã resolve, và mỗi nhóm là một lần gọi model. Nền do spec
  quyết định (`DocSpec.backgrounds`), người dùng chỉ chọn được trong phạm vi spec
  cho phép — nên không có đường nào xuất ra visa Mỹ nền xanh. `/api/export` kiểm
  lại ràng buộc đó lần nữa ở server, không tin client.
- **Mức khắt khe khi kết luận — theo `DocSpec.family`.** Model chấm 6 tiêu chí y
  như nhau ở mọi trường hợp (quan sát không phụ thuộc mục đích dùng ảnh); chỉ
  việc KẾT LUẬN là khác. Ảnh chân dung được cười và được đeo kính, nên hai tiêu chí
  đó không bắt buộc. `requiredChecks` vẫn nhận nhiều họ và siết theo hợp của chúng —
  giữ lại vì đó là cách đúng, dù chế độ tách ở trang chủ khiến hiện tại luôn chỉ có
  một họ.

## Model

| Việc | Model | Đổi bằng |
|------|-------|----------|
| Thay nền, retouch | `gemini-3.1-flash-lite-image` | `GEMINI_IMAGE_MODEL` |
| Studio sáng tạo (vẽ lại toàn bộ) | `gemini-3.1-flash-image` | `GEMINI_IMAGE_MODEL_HIRES` |
| Đo landmark, chấm tiêu chí | `gemini-3.5-flash-lite` | `GEMINI_TEXT_MODEL` |

Bản `-lite-image` chỉ xuất được 1K, nên bật `hiRes` phải đổi CẢ model chứ không chỉ
`imageSize` — `retouch()` tự làm việc đó. Đặt `GEMINI_IMAGE_SIZE` để ép kích thước cho
mọi lần gọi. Khi khung crop nhỏ hơn kích thước đích, file xuất ra được đánh dấu
`upscaled` và màn Hoàn tất nói thẳng là ảnh đã bị phóng to.

Studio sáng tạo dùng bản KHÔNG-lite vì nó vẽ lại toàn bộ khung cảnh — chất lượng
model là sản phẩm. Luồng ảnh thẻ dùng bản lite (thay nền là việc nhỏ) và làm nét
bằng tích chập, không bao giờ sinh lại pixel mặt.

## Chạy

```bash
cp .env.example .env.local   # điền GEMINI_API_KEY
npm run dev
```

Camera cần HTTPS hoặc `localhost`. Nút "Dùng ảnh có sẵn trong máy" chạy được ở
mọi nơi.

```bash
npm test        # docs + checks + geometry + render + gemini prompt (không gọi mạng)
npm run build
```

Một cái bẫy đã dính và đã có test chặn: `sharp().stats()` **bỏ qua** `extract()`
đứng trước nó, nên `extract(góc).stats()` trả về trung bình CẢ ẢNH. Muốn đo một
vùng thì phải `extract().raw()` rồi tự tính — xem `regionMean`.

## Spec giấy tờ chưa verify

`src/lib/docs.ts` đánh dấu `verified: false` cho những spec **chưa** đối chiếu
văn bản gốc (Schengen, 3×4, 4×6, thi cử). Các con số đó đang lấy theo thông lệ.
Trước khi mở bán loại giấy tờ nào thì phải verify `headRatio` / `eyeFromBottom` /
`backgrounds` của loại đó với nguồn chính thức — sai một con số là ảnh bị từ chối
ở quầy. UI đang hiện nhãn cảnh báo ở màn Xuất ảnh.

Riêng `backgrounds` đang để **hẹp hơn** thông lệ ở chỗ chưa chắc: Schengen chỉ để
trắng dù một số nước nhận xám nhạt. Cho phép rộng hơn chuẩn là đẩy rủi ro sang
khách, còn để hẹp thì chỉ mất một lựa chọn.
