import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/schemas"

export type ImageType = "jpeg" | "png" | "webp"
export type PhotoCheckResult = { ok: true } | { ok: false; code: "file_too_large" }
export type PhotoFileResult =
  | { ok: true; type: ImageType }
  | { ok: false; code: "file_too_large" | "unsupported_media_type" }

const HEADER_BYTES = 12

/** AC-09: size limit, inclusive of 10 MB. */
export function checkPhotoSize(bytes: number): PhotoCheckResult {
  return bytes <= MAX_IMAGE_BYTES ? { ok: true } : { ok: false, code: "file_too_large" }
}

/** Detects the image type from magic bytes, never from the file name (AC-08). */
export function detectImageType(header: Uint8Array): ImageType | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "jpeg"
  }
  if (header.length >= 4 && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return "png"
  }
  // RIFF????WEBP
  if (
    header.length >= HEADER_BYTES &&
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) {
    return "webp"
  }
  return null
}

async function readHeader(file: Blob): Promise<Uint8Array> {
  const slice = file.slice(0, HEADER_BYTES)
  if (typeof slice.arrayBuffer === "function") {
    return new Uint8Array(await slice.arrayBuffer())
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(slice)
  })
}

/** Size first, then content type (magic bytes). Used by PhotoInput before a file is kept. */
export async function validatePhotoFile(file: File): Promise<PhotoFileResult> {
  const size = checkPhotoSize(file.size)
  if (!size.ok) return size
  const type = detectImageType(await readHeader(file))
  if (type === null) return { ok: false, code: "unsupported_media_type" }
  return { ok: true, type }
}

export const PHOTO_ACCEPT = ALLOWED_IMAGE_TYPES.join(",")
