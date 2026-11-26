import "server-only"
import sharp from "sharp"
import { MAX_IMAGE_BYTES } from "@/lib/schemas"

const MAX_INPUT_PIXELS = 50_000_000
const MODEL_IMAGE_EDGE = 1536
const MODEL_IMAGE_MAX_BYTES = 1_500_000
const THUMBNAIL_EDGE = 640

type SupportedFormat = "jpeg" | "png" | "webp"

export function checkSize(byteLength: number):
  | { ok: true }
  | { ok: false; code: "file_too_large" } {
  return byteLength <= MAX_IMAGE_BYTES ? { ok: true } : { ok: false, code: "file_too_large" }
}

export async function inspectImage(
  buf: Buffer,
): Promise<
  | { ok: true; format: SupportedFormat; width: number; height: number }
  | { ok: false; code: "unsupported_media_type" }
> {
  try {
    const metadata = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
    if (
      (metadata.format !== "jpeg" && metadata.format !== "png" && metadata.format !== "webp") ||
      metadata.width === undefined ||
      metadata.height === undefined
    ) {
      return { ok: false, code: "unsupported_media_type" }
    }

    return {
      ok: true,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
    }
  } catch {
    return { ok: false, code: "unsupported_media_type" }
  }
}

export async function prepareForModel(buf: Buffer): Promise<{
  buffer: Buffer
  mediaType: "image/jpeg"
  width: number
  height: number
  bytes: number
}> {
  async function encode(quality: 80 | 65) {
    return sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width: MODEL_IMAGE_EDGE,
        height: MODEL_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toBuffer({ resolveWithObject: true })
  }

  let result = await encode(80)
  if (result.info.size > MODEL_IMAGE_MAX_BYTES) result = await encode(65)

  return {
    buffer: result.data,
    mediaType: "image/jpeg",
    width: result.info.width,
    height: result.info.height,
    bytes: result.info.size,
  }
}

export async function makeThumbnail(buf: Buffer): Promise<string> {
  const thumbnail = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({
      width: THUMBNAIL_EDGE,
      height: THUMBNAIL_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 70 })
    .toBuffer()

  return `data:image/webp;base64,${thumbnail.toString("base64")}`
}
