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
