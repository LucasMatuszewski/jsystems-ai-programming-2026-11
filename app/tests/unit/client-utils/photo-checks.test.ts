import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  checkPhotoSize,
  detectImageType,
  validatePhotoFile,
} from "@/components/case-form/photo-checks"

const repoFile = (rel: string) =>
  readFileSync(path.resolve(process.cwd(), `../${rel}`))
const header = (rel: string) => new Uint8Array(repoFile(rel).subarray(0, 12))

describe("checkPhotoSize", () => {
  it("accepts exactly 10 MB", () => {
    expect(checkPhotoSize(10485760)).toEqual({ ok: true })
  })
  it("rejects one byte above 10 MB", () => {
    expect(checkPhotoSize(10485761)).toEqual({ ok: false, code: "file_too_large" })
  })
})

describe("detectImageType (magic bytes of real files)", () => {
  it("detects JPEG content in a file named .png (AC-08)", () => {
    expect(detectImageType(header("assets/example-images/laptop-1.png"))).toBe("jpeg")
  })
  it("detects JPEG for .jpg and .jpeg files", () => {
    expect(detectImageType(header("assets/example-images/phone-1.jpg"))).toBe("jpeg")
    expect(detectImageType(header("assets/example-images/phone-2.jpeg"))).toBe("jpeg")
  })
  it("detects WebP (RIFF....WEBP)", () => {
    expect(detectImageType(header("assets/example-images/laptop-2.webp"))).toBe("webp")
  })
  it("detects PNG (89 50 4E 47) using a real PNG outside example-images", () => {
    expect(detectImageType(header("assets/homepage.png"))).toBe("png")
  })
  it("rejects an SVG file (AC-09)", () => {
    expect(detectImageType(header("assets/logo.svg"))).toBeNull()
  })
  it("returns null for a header shorter than the WebP signature", () => {
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull()
  })
})

describe("validatePhotoFile", () => {
  it("accepts a JPEG named .png", async () => {
    const file = new File([repoFile("assets/example-images/laptop-1.png")], "laptop-1.png", {
      type: "image/png",
    })
    expect(await validatePhotoFile(file)).toEqual({ ok: true, type: "jpeg" })
  })
  it("rejects logo.svg with unsupported_media_type", async () => {
    const file = new File([repoFile("assets/logo.svg")], "logo.svg", { type: "image/svg+xml" })
    expect(await validatePhotoFile(file)).toEqual({ ok: false, code: "unsupported_media_type" })
  })
})
