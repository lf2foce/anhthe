import "server-only";

/**
 * Lưu ảnh ra object storage (Cloudflare R2, giao thức S3) thay vì nhét base64
 * vào JSON.
 *
 * Vì sao đáng đổi — nó gỡ BỐN thứ cùng lúc, không phải một:
 *
 * 1. F5 mất sạch: ảnh nằm ở R2 nên mở lại vẫn còn.
 * 2. Trần response 4,5MB của nền tảng: trả URL thì payload còn vài trăm byte.
 * 3. Tab crash trên máy yếu: client không còn ôm data URL full-res trong RAM để
 *    vẽ ở thumbnail 46px.
 * 4. Nền móng cho tài khoản và giao hàng có trả phí.
 *
 * KHÔNG cần tài khoản: khoá thư mục là cookie ẩn danh `aid` đã có sẵn từ gate.
 * Sau này gắn Clerk thì chuyển object theo `aid` sang user, không phải làm lại.
 *
 * Chưa cấu hình R2 thì rơi về data URL như cũ — `npm run dev` và test vẫn chạy,
 * chỉ là không có gì bền.
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { watermarked } from "./watermark";
import { toDataUrl } from "./imageio";

const accountId = process.env.PHOTO_R2_ACCOUNT_ID;
const accessKeyId = process.env.PHOTO_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.PHOTO_R2_SECRET_ACCESS_KEY;
const bucket = process.env.PHOTO_R2_BUCKET;

const client =
  accountId && accessKeyId && secretAccessKey && bucket
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null;

export const usingObjectStore = client !== null;

/**
 * Link ký có hạn. Ảnh là khuôn mặt người thật — bucket phải để RIÊNG TƯ, không
 * dựa vào khoá khó đoán. Một giờ đủ để xem và tải trong một phiên.
 */
const SIGNED_URL_TTL = 60 * 60;

export interface StoredImage {
  /** Link xem được ngay — bản đóng dấu nếu chưa mở khoá */
  url: string;
  /** Khoá object của bản SẠCH, để mở khoá sau khi trả tiền */
  key: string;
  /** Đã là bản sạch chưa, hay đang là bản xem thử */
  unlocked: boolean;
}

function keyFor(clientId: string, sessionId: string, name: string): string {
  return `${clientId}/${sessionId}/${name}`;
}

/**
 * Cache-Control cho link presigned. Hạn link 1 giờ nên cache dài hơn là vô nghĩa,
 * còn không đặt gì thì mỗi lần cuộn qua thumbnail lại là một lượt egress.
 */
const CACHE_CONTROL = "private, max-age=3600";

async function put(key: string, body: Buffer): Promise<void> {
  await client!.send(
    new PutObjectCommand({
      Bucket: bucket!,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
      CacheControl: CACHE_CONTROL,
    })
  );
}

export async function signedUrl(key: string): Promise<string> {
  return getSignedUrl(
    client!,
    new GetObjectCommand({ Bucket: bucket!, Key: key }),
    { expiresIn: SIGNED_URL_TTL }
  );
}

/**
 * Cất một ảnh: lưu CẢ bản sạch lẫn bản đóng dấu.
 *
 * Lưu cả hai lúc upload chứ không đóng dấu lúc phục vụ: đóng dấu mỗi lần xem là
 * tốn CPU mỗi request, còn lưu thêm một object thì rẻ và có TTL dọn hộ. Quan
 * trọng hơn: bản sạch PHẢI có sẵn khi khách trả tiền — sinh lại là thêm một lần
 * gọi model, tức bán một tấm ảnh mà tốn tiền hai lần.
 */
export async function storeImage(opts: {
  clientId: string;
  sessionId: string;
  name: string;
  buffer: Buffer;
  /** true = trả thẳng bản sạch (đã mở khoá) */
  unlocked?: boolean;
}): Promise<StoredImage> {
  const cleanKey = keyFor(opts.clientId, opts.sessionId, `${opts.name}.jpg`);

  if (!client) {
    // Chưa cấu hình R2: giữ nguyên hành vi cũ để dev/test chạy được. Không bền,
    // và không có ranh giới khoá — nói rõ ở README.
    return {
      url: toDataUrl(opts.buffer.toString("base64"), "image/jpeg"),
      key: cleanKey,
      unlocked: true,
    };
  }

  // Khoá bản xem thử KHÔNG được suy ra từ khoá bản sạch (và ngược lại). Đặt
  // `x-xem.jpg` cạnh `x.jpg` thì chỉ cần bỏ hậu tố là có ảnh sạch miễn phí —
  // hiện không khai thác được vì bucket riêng tư + presigned, nhưng một ngày ai
  // đó bật public bucket theo thói quen từ dự án khác là tường phí bay ngay.
  const markKey = keyFor(
    opts.clientId,
    opts.sessionId,
    `${crypto.randomUUID().replace(/-/g, "")}.jpg`
  );
  const mark = await watermarked(opts.buffer);
  await Promise.all([put(cleanKey, opts.buffer), put(markKey, mark)]);

  return {
    url: await signedUrl(opts.unlocked ? cleanKey : markKey),
    key: cleanKey,
    unlocked: !!opts.unlocked,
  };
}

/** Sinh id phiên — gom ảnh của một lượt vào cùng thư mục để dọn theo TTL */
export function newSessionId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/**
 * Khoá object có đúng của khách này không.
 *
 * Chốt bắt buộc trước khi cấp link bản sạch: khoá bắt đầu bằng `clientId`, nên
 * chỉ cần so tiền tố. Thiếu bước này thì ai đoán được khoá là tải được ảnh
 * người khác — và đây là ảnh khuôn mặt.
 */
export function ownsKey(clientId: string, key: string): boolean {
  return key.startsWith(`${clientId}/`) && !key.includes("..");
}

/**
 * Link này có được phép đi qua proxy tải hộ (/api/blob) không.
 *
 * Vì sao phải có proxy: nút "Tải tất cả (.zip)" gói ảnh bằng `fetch` từ browser,
 * mà bucket R2 riêng tư không mở CORS — fetch chéo origin chết bằng đúng một câu
 * "Failed to fetch" (đã xảy ra). Token S3 hiện tại không có quyền PutBucketCors
 * (thử rồi: AccessDenied), nên server tải hộ là đường không phụ thuộc cấu hình
 * bucket.
 *
 * Vì sao phải VALIDATE chứ không fetch bừa: route nhận nguyên một URL từ client
 * — không khoá lại thì nó là máy SSRF công cộng. Ba chốt, thiếu một là từ chối:
 *
 * 1. Đúng host R2 của MÌNH — không bao giờ fetch host lạ.
 * 2. Path nằm trong thư mục của CHÍNH khách đang gọi (cùng luật với `ownsKey`).
 * 3. Link vẫn phải là presigned còn hạn — proxy không né chữ ký, chỉ né CORS.
 */
export function proxyAllowed(clientId: string, raw: string): boolean {
  if (!client) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.pathname.includes("..")) return false;

  // SDK ký URL dạng VIRTUAL-HOSTED (bucket là subdomain) — đối chiếu bằng link
  // thật, không phải giả định: bản đầu chỉ nhận path-style và chặn nhầm chính
  // link mình vừa ký. Nhận cả hai dạng vì cùng một object.
  const base = `${accountId}.r2.cloudflarestorage.com`;
  return (
    (url.host === `${bucket}.${base}` &&
      url.pathname.startsWith(`/${clientId}/`)) ||
    (url.host === base && url.pathname.startsWith(`/${bucket}/${clientId}/`))
  );
}
