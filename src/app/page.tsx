import { Studio } from "@/components/Studio";
import { IMAGE_MODEL, IMAGE_MODEL_HIRES, TEXT_MODEL } from "@/lib/gemini";

/**
 * Server component: đọc tên model ở đây rồi truyền xuống, vì lib/gemini là
 * `server-only` và nhãn ở footer phải nói đúng model đang chạy thật.
 */
export default function Page() {
  return (
    <Studio
      imageModel={IMAGE_MODEL}
      creativeModel={IMAGE_MODEL_HIRES}
      textModel={TEXT_MODEL}
    />
  );
}
