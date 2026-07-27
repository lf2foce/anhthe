-- Kho đếm hạn mức dùng chung giữa các instance.
--
-- Vì sao cần: bộ đếm trong RAM chỉ đúng khi chạy MỘT tiến trình. Trên serverless
-- mỗi instance đếm riêng, nên trần thật = trần × số instance — và số instance
-- tăng đúng lúc bị dội request, tức nó hỏng đúng lúc cần nhất.
--
-- Không cần Redis: một bảng đếm với UPSERT đã atomic sẵn.

CREATE TABLE IF NOT EXISTS photo_quota (
  -- id khách ẩn danh (32 ký tự hex), hoặc '__global__' cho hàng đếm toàn cục
  key  text  NOT NULL,
  day  date  NOT NULL,
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, day)
);

-- Dọn hàng cũ: chỉ hôm nay mới có ý nghĩa. Chạy định kỳ, hoặc để đó cũng được
-- vì bảng này rất nhẹ.
-- DELETE FROM photo_quota WHERE day < CURRENT_DATE - INTERVAL '7 days';

-- Đơn hàng. Thu tiền bằng chuyển khoản + mã memo, đối soát tay — không cổng
-- thanh toán, không webhook. Tự động hoá khi nào lượng đơn đủ phiền.
CREATE TABLE IF NOT EXISTS photo_order (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   text NOT NULL,
  session_id  text NOT NULL,
  plan_id     text NOT NULL,
  amount_vnd  integer NOT NULL,
  -- Mã khách gõ vào nội dung chuyển khoản. Phải là duy nhất: đối soát dựa vào nó.
  memo        text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  paid_at     timestamptz
);

CREATE INDEX IF NOT EXISTS photo_order_session
  ON photo_order (client_id, session_id);
