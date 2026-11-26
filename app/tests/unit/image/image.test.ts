import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { describe, expect, it, vi } from "vitest"
import { checkSize, inspectImage, makeThumbnail, prepareForModel } from "@/server/image"

vi.mock("server-only", () => ({}))

const assets = path.resolve(__dirname, "../../../../assets")
const examples = path.join(assets, "example-images")

const photos = [
  { file: "laptop-1.png", format: "jpeg", width: 3024, height: 3135 },
  { file: "laptop-2.webp", format: "webp", width: 863, height: 843 },
  { file: "phone-1.jpg", format: "jpeg", width: 900, height: 1200 },
  { file: "phone-2.jpeg", format: "jpeg", width: 387, height: 516 },
  { file: "phone-3.jpeg", format: "jpeg", width: 449, height: 445 },
] as const

describe("image inspection", () => {
  it.each(photos)("detects $file from its contents", async ({ file, format, width, height }) => {
    const result = await inspectImage(fs.readFileSync(path.join(examples, file)))
    expect(result).toEqual({ ok: true, format, width, height })
  })

  it("rejects the real SVG logo", async () => {
    const result = await inspectImage(fs.readFileSync(path.join(assets, "logo.svg")))
    expect(result).toEqual({ ok: false, code: "unsupported_media_type" })
  })
})

describe("model image preparation", () => {
  it.each(photos)("prepares $file as a metadata-free JPEG", async ({ file, width, height }) => {
    const output = await prepareForModel(fs.readFileSync(path.join(examples, file)))
    const expectedLongEdge = Math.min(Math.max(width, height), 1536)

    expect(output.mediaType).toBe("image/jpeg")
    expect(Math.max(output.width, output.height)).toBe(expectedLongEdge)
    expect(output.bytes).toBe(output.buffer.byteLength)
    expect(output.bytes).toBeLessThanOrEqual(1_500_000)

    const metadata = await sharp(output.buffer).metadata()
    expect(metadata.format).toBe("jpeg")
    expect(metadata.exif).toBeUndefined()
    expect(metadata.icc).toBeUndefined()
    expect(metadata.xmp).toBeUndefined()
  })

  it("does not enlarge phone-2.jpeg", async () => {
    const output = await prepareForModel(fs.readFileSync(path.join(examples, "phone-2.jpeg")))
    expect(Math.max(output.width, output.height)).toBe(516)
  })
})

describe("thumbnail creation", () => {
  it.each(photos)("creates a compact WebP thumbnail for $file", async ({ file, width, height }) => {
    const result = await makeThumbnail(fs.readFileSync(path.join(examples, file)))
    expect(result.startsWith("data:image/webp;base64,")).toBe(true)

    const buffer = Buffer.from(result.slice("data:image/webp;base64,".length), "base64")
    const metadata = await sharp(buffer).metadata()
    expect(buffer.byteLength).toBeLessThanOrEqual(100_000)
    expect(metadata.format).toBe("webp")
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBe(Math.min(Math.max(width, height), 640))
  })
})

describe("upload size", () => {
  it("accepts exactly 10 MiB and rejects one byte more", () => {
    expect(checkSize(10_485_760)).toEqual({ ok: true })
    expect(checkSize(10_485_761)).toEqual({ ok: false, code: "file_too_large" })
  })
})
