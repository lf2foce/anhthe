-- Khôi phục phiên + email nhận hàng.
--
-- Vì sao: trước migration này, toàn bộ phiên chỉ nằm trong RAM của tab. Khách
-- chuyển khoản xong mà lỡ F5 (hoặc điện thoại khoá màn hình, trình duyệt thu hồi
-- tab) là mất đường về: ảnh sạch vẫn nằm trong R2, đơn vẫn `paid`, nhưng UI
-- không còn `sessionId` nên không xin lại link được — và làm lại từ đầu thì sinh
-- sessionId mới, đơn cũ vô giá trị. Khách trả tiền mà không nhận được hàng.
--
-- Cách chữa: server ghi lại DANH SÁCH FILE của mỗi phiên xuất. Cookie `aid` đã
-- sống 30 ngày và khoá R2 vốn đặt theo clientId, nên chỉ cần bảng này là dựng
-- lại được màn Hoàn tất mà không cần tài khoản.

CREATE TABLE IF NOT EXISTS photo_session (
  client_id   text NOT NULL,
  session_id  text NOT NULL,
  -- Nguyên mảng ExportedFile đã trả cho client. Lưu JSON thay vì bảng con: đây
  -- là ẢNH CHỤP kết quả một lượt xuất, không phải thực thể để truy vấn từng phần.
  files       jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, session_id)
);

-- Email để gửi lại link khi hỏng, gửi hoá đơn, và là tài sản marketing duy nhất
-- của mô hình ẩn danh. XIN LÚC TRẢ TIỀN, không phải lúc vào — bắt đăng ký trước
-- khi khách thấy ảnh đẹp là cách giết chuyển đổi nhanh nhất.
ALTER TABLE photo_order ADD COLUMN IF NOT EXISTS email text;

-- Dashboard đọc theo NGÀY (doanh thu hôm nay, 30 ngày) — không có index thì mỗi
-- lần mở trang là quét toàn bảng.
CREATE INDEX IF NOT EXISTS photo_order_paid_at
  ON photo_order (paid_at) WHERE status = 'paid';
