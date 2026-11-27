/**
 * Reads an NDJSON byte stream and yields one parsed JSON value per non-blank line.
 * Lines may be split across chunks, including inside a multi-byte UTF-8 sequence
 * (the decoder keeps partial bytes with `stream: true`).
 */
export async function* readNdjson(stream: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = stream.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf("\n")
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line.length > 0) yield JSON.parse(line) as unknown
        newline = buffer.indexOf("\n")
      }
    }
    buffer += decoder.decode()
    const rest = buffer.trim()
    if (rest.length > 0) yield JSON.parse(rest) as unknown
  } finally {
    reader.releaseLock()
  }
}
