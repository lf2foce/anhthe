# Runbook — Ảnh thẻ Studio

Sổ tay vận hành. README nói app *làm gì* và *vì sao thiết kế vậy*; file này nói
*chạy nó thế nào* và *hỏng thì làm gì*.

Mỗi cảnh báo dưới đây neo vào một sự cố THẬT đã xảy ra lúc dựng, không phải lo xa.

---

## 1. Bức tranh phụ thuộc

| Thứ | Dùng để | Thiếu thì sao |
|---|---|---|
| **Gemini API** | chấm ảnh, thay nền, sinh ảnh sáng tạo | app không làm được gì — đây là phụ thuộc DUY NHẤT bắt buộc |
| **Neon Postgres** | đếm hạn mức, lưu đơn hàng | rơi về đếm trong RAM (sai trên nhiều instance), không thu tiền được |
| **Cloudflare R2** | lưu ảnh, ranh giới bản xem thử / bản sạch | rơi về data URL — F5 mất ảnh, **không có tường phí** |
| **Tài khoản ngân hàng** | QR chuyển khoản | không mời trả tiền được, app chạy miễn phí trong hạn mức |

Ba cái sau đều **tự rơi về đường dự phòng** nếu thiếu biến môi trường. Đó là cố ý
để `npm run dev` chạy được với zero cấu hình — nhưng cũng có nghĩa **thiếu biến
không báo lỗi, chỉ âm thầm mất tính năng**. Xem mục 6 để kiểm.

---

## 2. Biến môi trường

### Bắt buộc

| Biến | Lấy ở đâu |
|---|---|
| `GEMINI_API_KEY` | aistudio.google.com/apikey |

### Kho đếm — cần cho production

| Biến | Lấy ở đâu |
|---|---|
| `PHOTO_DATABASE_URL` | Neon → Connection string (dùng bản **pooler**) |

Chưa chạy migration thì mọi lượt gọi model trả **503** (`GATE_UNAVAILABLE`) — gate
cố tình CHẶN khi kho đếm lỗi, không cho qua.

### Kho ảnh — cần cho production

| Biến | Lấy ở đâu |
|---|---|
| `PHOTO_R2_ACCOUNT_ID` | Cloudflare → R2 → Overview → Account Details → Account ID (32 ký tự hex) |
| `PHOTO_R2_ACCESS_KEY_ID` | R2 → Manage API Tokens → Create → mục "for S3 clients" |
| `PHOTO_R2_SECRET_ACCESS_KEY` | cùng chỗ — **chỉ hiện MỘT lần** |
| `PHOTO_R2_BUCKET` | tên bucket, vd `anhthe` |

Cái *Token value* (`cfat_…`) trên màn hình đó là cho REST API của Cloudflare —
**không dùng**. App nói giao thức S3.

### Thu tiền — hoãn được

| Biến | Là gì |
|---|---|
| `PHOTO_BANK_CODE` | mã BIN ngân hàng theo chuẩn Napas/VietQR, 6 số (Vietcombank `970436`, Techcombank `970407`, MB `970422`, ACB `970416`, BIDV `970418`, VietinBank `970415`) — đối chiếu lại trên vietqr.io |
| `PHOTO_BANK_ACCOUNT` | số tài khoản nhận tiền |
| `PHOTO_BANK_NAME` | tên chủ tài khoản, IN HOA không dấu |
| `PHOTO_ADMIN_TOKEN` | chuỗi bí mật **tự đặt** — mật khẩu cho route đánh dấu đã trả tiền. `openssl rand -hex 24` |

Không đặt `PHOTO_ADMIN_TOKEN` thì `/api/admin/mark-paid` **tắt hẳn** (404). Cố ý:
mặc định mở là ai cũng tự đánh dấu đã trả tiền hộ nhau.

### Chỉnh mức

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PHOTO_GLOBAL_DAILY_CALLS` | 400 | trần gọi model TOÀN HỆ THỐNG mỗi ngày — **đặt theo số tiền tối đa chấp nhận mất trong một ngày xấu nhất**, không theo kỳ vọng lưu lượng |
| `PHOTO_FREE_DAILY_CALLS` | 12 | hạn mức mỗi khách mỗi ngày |
| `GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-lite-image` | model thay nền |
| `GEMINI_IMAGE_MODEL_HIRES` | `gemini-3.1-flash-image` | model Studio sáng tạo |
| `GEMINI_TEXT_MODEL` | `gemini-3.5-flash-lite` | model chấm ảnh |

> **Bẫy đã dính:** dán cả comment vào giá trị. `PHOTO_R2_ACCOUNT_ID=  aa48…336  # 32 ký tự hex`
> ra một chuỗi 86 ký tự và R2 từ chối im lặng. Giá trị phải **sạch**, không dấu
> cách đầu, không comment cuối dòng.

---

## 3. Dựng lần đầu

### 3.1 Neon

1. Tạo project mới (đừng dùng chung DB với dự án khác).
2. Copy **pooled connection string** vào `PHOTO_DATABASE_URL`.
3. Chạy migration:

```bash
psql "$PHOTO_DATABASE_URL" -f migrations/001_photo_quota.sql
```

Kiểm: phải thấy hai bảng `photo_quota` và `photo_order`.

### 3.2 Cloudflare R2

1. **Create bucket**, location APAC.
2. **KHÔNG bật Public access / r2.dev.** Bucket phải riêng tư — ảnh là khuôn mặt
   người thật, và tường phí dựa vào presigned URL.
3. **Manage API Tokens → Create**:
   - Permission: **Object Read & Write** (không phải Admin, không phải Read only —
     app phải ghi ảnh lên)
   - Buckets: **Apply to specific buckets only** → chọn đúng bucket này

   > Nếu tài khoản Cloudflare này còn dùng cho dự án khác, để "all buckets" nghĩa
   > là key của app ảnh thẻ cầm quyền ghi/xoá lên toàn bộ bucket kia. Câu
   > "including newly created buckets" còn tệ hơn: mọi bucket tạo sau cũng dính.

4. **Settings → Object lifecycle rules → Add** → xoá object sau **7 ngày**, prefix trống.

   > "Default Multipart Abort Rule" có sẵn KHÔNG phải cái này — nó chỉ dọn upload
   > dở dang. App lưu **hai** object mỗi ảnh (sạch + đóng dấu), không có rule xoá
   > thì dung lượng chỉ tăng một chiều.

### 3.3 Ngân hàng

Chỉ cần khi muốn thu tiền. Xem mục 2.

---

## 4. Chạy local

```bash
cp .env.example .env.local     # điền GEMINI_API_KEY là chạy được
npm run dev
```

Zero cấu hình ngoài Gemini key: hạn mức đếm trong RAM, ảnh trả về dạng data URL,
không có tường phí. Đủ để phát triển giao diện.

```bash
npm test         # không gọi mạng
npm run build
```

---

## 5. Deploy (Vercel)

Số đo thật, không phải suy từ config:

| | đo được | trần Vercel |
|---|---|---|
| `/api/generate` count=2 thường | 9,6s · 0,51 MB | 60s (Hobby) · 4,5 MB |
| `/api/generate` count=2 ở 2K | 14,1s · 2,18 MB | |

Nằm trong ngưỡng. Hai thứ đã xử để khớp: `maxDuration` để 60 (không phải 180), và
ở 2K trần biến thể hạ còn 2 vì 4 ảnh 2K ≈ 4,4 MB, sát trần response.

**Bắt buộc trước khi đẩy:** `PHOTO_DATABASE_URL` phải có. Bộ đếm trong RAM chỉ
đúng khi chạy MỘT tiến trình; trên serverless mỗi instance đếm riêng nên trần
thật = trần × số instance — và số instance **tăng đúng lúc bị dội request**, tức
nó hỏng đúng lúc cần nhất.

Dán biến vào Vercel → Settings → Environment Variables, rồi deploy.

---

## 6. Kiểm tra sức khoẻ sau deploy

```bash
D=https://<domain>

# 1. Trang chạy
curl -s -o /dev/null -w "%{http_code}\n" $D/            # 200
curl -s -o /dev/null -w "%{http_code}\n" $D/app         # 200

# 2. Kho đếm — nếu Neon hỏng thì lệnh này vẫn 200 nhưng gọi model sẽ 503
curl -s $D/api/me                                       # {"remaining":12,"perDay":12}

# 3. Trần dung lượng chặn TRƯỚC khi parse
python3 -c "print('{\"photo\":\"'+'a'*13000000+'\"}')" > /tmp/big.json
curl -s -X POST $D/api/generate -H 'content-type: application/json' \
  --data-binary @/tmp/big.json -w " %{http_code}\n"     # 413 TOO_LARGE

# 4. Thu tiền đã bật chưa
curl -s -X POST $D/api/order -H 'content-type: application/json' \
  -d '{"sessionId":"0123456789abcdef","planId":"creative"}'
# có memo + qrUrl = đã bật; 503 = chưa cấu hình ngân hàng
```

Kiểm **tường phí thật sự khoá** (quan trọng nhất, và là chỗ đã hỏng một lần):

1. Tạo một ảnh qua giao diện.
2. Tải ảnh trả về — **phải có chữ chìm**.
3. Nếu ảnh sạch trơn: watermark hỏng, xem mục 8.

---

## 7. Vận hành hằng ngày

### 7.1 Đối soát thanh toán

Hiện làm **bằng tay**. Vòng đời một đơn:

1. Khách bấm mở khoá → app hiện QR + mã memo dạng `AT86C22H`
2. Khách chuyển khoản, nội dung có mã đó
3. Anh thấy tiền về trong app ngân hàng kèm mã
4. Đánh dấu:

```bash
curl -X POST https://<domain>/api/admin/mark-paid \
  -H 'content-type: application/json' \
  -H "x-admin-token: $PHOTO_ADMIN_TOKEN" \
  -d '{"memo":"AT86C22H"}'
```

5. Khách bấm "Tôi đã chuyển khoản" → ảnh sạch mở ra

Trả `{"ok":true}` là xong. Trả 404 `"Không có đơn đang chờ với mã này"` nghĩa là
mã sai hoặc đơn đã đánh dấu rồi.

**Một phiên một đơn** — khách bấm mở khoá nhiều lần vẫn ra đúng mã cũ. Nếu tạo mã
mới mỗi lần thì khách chuyển theo mã cũ là tiền về mà đơn mới vẫn treo.

### 7.2 Xem tình hình

```sql
-- Đơn đang chờ tiền
SELECT memo, plan_id, amount_vnd, created_at FROM photo_order
WHERE status = 'pending' ORDER BY created_at DESC;

-- Doanh thu hôm nay
SELECT count(*), sum(amount_vnd) FROM photo_order
WHERE status = 'paid' AND paid_at::date = CURRENT_DATE;

-- Đã tiêu bao nhiêu lượt model hôm nay (so với PHOTO_GLOBAL_DAILY_CALLS)
SELECT used FROM photo_quota WHERE key = '__global__' AND day = CURRENT_DATE;

-- Khách dùng nhiều nhất hôm nay
SELECT key, used FROM photo_quota
WHERE day = CURRENT_DATE AND key <> '__global__' ORDER BY used DESC LIMIT 10;
```

### 7.3 Canh chi phí

Mỗi lượt là bao nhiêu lần gọi model:

| Thao tác | Lượt |
|---|---|
| Thay nền (`/api/retouch`) | 2 — một lần sinh ảnh, một lần chấm lại landmark |
| Tạo ảnh sáng tạo | = số biến thể (2 hoặc 4) |
| Tinh chỉnh / Nâng 2K | 1 |
| Chấm ảnh, xuất file | 0 — `/api/export` không gọi model |

Studio sáng tạo dùng model **không-lite**, đắt hơn hẳn thay nền. Giá mỗi ảnh
**chưa tự đo** — con số duy nhất đang có là ước lượng ~$0,07–0,10/ảnh từ một bản
phân tích, chưa đối chiếu hoá đơn thật. **Đo hoá đơn Google trong tuần đầu rồi
chốt lại giá gói** (`src/lib/pricing.ts`).

Trần toàn cục là thứ duy nhất chặn được kẻ cố ý. Cookie xoá được, IP đổi được;
trần toàn cục thì không phụ thuộc gì client gửi lên.

---

## 8. Hỏng thì làm gì

### Mọi lượt gọi model trả 503 `GATE_UNAVAILABLE`
Kho đếm lỗi. Gate **cố tình chặn** khi không đọc được hạn mức — một cú nấc DB làm
khách thấy "hệ thống bận" là phục hồi được, một hoá đơn model không trần thì không.

Kiểm: `PHOTO_DATABASE_URL` đúng chưa, đã chạy migration chưa, Neon có đang ngủ không.

### 503 `Hệ thống đã đạt giới hạn xử lý trong ngày`
Chạm `PHOTO_GLOBAL_DAILY_CALLS`. Đây có thể là **lưu lượng thật** hoặc **đang bị
phá**. Xem `photo_quota` để biết: một `key` chiếm phần lớn = một khách; rải đều
hàng trăm key = có người xoá cookie liên tục.

Nâng trần chỉ khi chắc là lưu lượng thật.

### 429 khách kêu hết lượt mà mới dùng vài lần
`/api/retouch` tốn **2 lượt**, tạo 4 biến thể tốn **4**. 12 lượt/ngày hết nhanh
hơn khách tưởng. Chỉnh `PHOTO_FREE_DAILY_CALLS`.

### Khách trả tiền rồi mà không mở khoá được (404 ở `/api/unlock`)
Khoá object không khớp `clientId` của khách — thường do **mất cookie** (đổi
trình duyệt, ẩn danh, xoá dữ liệu). Phiên gắn với cookie ẩn danh, mất cookie là
mất quyền với ảnh cũ.

Chưa có đường khôi phục. Đây là cái giá của "không bắt đăng nhập"; khi nào chuyện
này xảy ra thường xuyên thì đó là tín hiệu nên gắn tài khoản.

### Ảnh trả về KHÔNG có chữ chìm
Tường phí thủng. Đã xảy ra một lần: watermark vẽ bằng chữ trắng, mà ảnh thẻ theo
quy định nền trắng → trắng trên trắng, biến mất. Nay chữ trắng có viền đen và có
test cho cả ba nền (trắng / đen / trung tính) ở `src/lib/storage.test.ts`.

Nếu tái diễn: chạy `npm test -- storage`, và kiểm `usingObjectStore` — chưa cấu
hình R2 thì app trả thẳng bản sạch, **không có tường phí**.

### Ảnh mất sau khi F5
Chưa cấu hình R2 → data URL trong bộ nhớ. Xem mục 3.2.

### `/api/generate` timeout trên Vercel
Đo lại thời gian thật trước khi đổi gì. Số đo lúc dựng là 9,6s và 14,1s — nếu giờ
chạm 60s thì model đang chậm bất thường, không phải lỗi cấu hình.

---

## 9. Việc còn nợ

Nói thẳng để người tiếp quản không tưởng đã xong:

- ~~Lỗi lộ chữ thô của model~~ → ĐÃ XONG (29/07/2026): lib/errors.ts — lỗi chủ
  động mang câu Việt + mã; lỗi lạ chỉ trả câu chung, ruột nằm ở log server.
- **`vn34` — loại giấy tờ MẶC ĐỊNH — vẫn `verified: false`**, cùng `schen`,
  `vn46`, `exam`. Số đo lấy theo thông lệ, chưa đối chiếu văn bản gốc. Đây là rủi
  ro hoàn tiền thật khi đã thu tiền.
- **Hai spec chân dung `link` và `profile45` là code chết** — đủ spec và test
  nhưng không còn đường nào vào giao diện sau lần tách luồng.
- ~~Đối soát thanh toán thủ công~~ → ĐÃ XONG (29/07/2026): webhook SePay, xem
  mục 10. Đường tay qua `/api/admin/mark-paid` vẫn giữ làm dự phòng.
- **Không có observability**: không request id, không đếm lần gọi model theo thời
  gian, không biết tỉ lệ lỗi. Khi có khách thật thì đây là thứ thiếu đau nhất.

---

## 10. Thanh toán tự động qua SePay

Luồng: khách quét VietQR kèm mã memo → tiền vào tài khoản → SePay bắn webhook →
app khớp memo + kiểm số tiền → đơn chuyển `paid` → UI khách đang mở tự poll 6s/lần
thấy paid là mở khoá, không cần bấm gì.

### Cấu hình một lần

1. Tạo tài khoản [sepay.vn](https://sepay.vn), liên kết đúng tài khoản ngân hàng
   đang nhận tiền (khớp `PHOTO_BANK_CODE`/`PHOTO_BANK_ACCOUNT`).
2. SePay → Webhooks → thêm webhook:
   - URL: `https://<domain>/api/webhooks/sepay`
   - Kiểu xác thực: **Api Key** — sinh một chuỗi ngẫu nhiên dài, dán vào SePay.
3. Đặt env `PHOTO_SEPAY_API_KEY=<chuỗi đó>` rồi deploy lại.

### Tính chất phải giữ khi sửa

- **Thiếu env / thiếu DB là 503** — webhook không xác thực được thì thà chết.
  Đây là chốt chống "fail-open": ai đó tự bắn payload đánh dấu đơn mình đã trả.
- Giao dịch không liên quan (tiền ra, không mã, không đơn) trả **2xx** — trả 4xx
  là SePay retry mãi một giao dịch không bao giờ khớp.
- **Thiếu tiền thì KHÔNG mở khoá**, chỉ log (`[webhook/sepay] ... thiếu tiền`) —
  xử tay: hoàn tiền hoặc nhắn khách chuyển bổ sung rồi `mark-paid`.
- Phần thuần (tìm memo trong nội dung bẩn, lọc giao dịch) nằm ở `lib/sepay.ts`,
  có test — sửa cách tìm mã thì sửa ở đó và chạy test, đừng sửa trong route.

### Thử nhanh sau khi cấu hình

```bash
curl -s -X POST https://<domain>/api/webhooks/sepay \
  -H "Authorization: Apikey $PHOTO_SEPAY_API_KEY" \
  -H "content-type: application/json" \
  -d '{"transferType":"in","transferAmount":49000,"content":"MBVCB.1.ATABC234.test"}'
# → {"success":true,"ignored":"không có đơn"} nếu mã không khớp đơn nào — nghĩa là
# xác thực + parse chạy đúng. Sai key phải ra 401; bỏ header phải ra 401.
```
