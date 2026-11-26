import "server-only"

/**
 * Reads a request body while counting bytes, so a limit holds even when the client sends no
 * `Content-Length` (chunked upload). Returns `null` as soon as the limit is exceeded; the
 * remaining body is cancelled, never buffered (T28 F5).
 */
export async function readBodyLimited(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = request.headers.get("content-length")
  if (declared !== null && Number(declared) > maxBytes) return null
  if (!request.body) return new Uint8Array(0)

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
