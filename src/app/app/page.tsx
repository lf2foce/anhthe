import { Studio } from "@/components/Studio";
import { IMAGE_MODEL, IMAGE_MODEL_HIRES, TEXT_MODEL } from "@/lib/gemini";

/**
 * Studio thật, tách khỏi landing ở `/`.
 *
 * Server component: đọc tên model ở đây rồi truyền xuống, vì lib/gemini là
 * `server-only` và nhãn ở chân trang phải nói đúng model đang chạy thật.
 */
export const metadata = {
  title: "Ảnh thẻ Studio",
};

export default function AppPage() {
  return (
    <Studio
      imageModel={IMAGE_MODEL}
      creativeModel={IMAGE_MODEL_HIRES}
      textModel={TEXT_MODEL}
    />
  );
}
