// Pure structural comparison of recorded vs live HTTP captures (ADR-006).
// Compares status codes and the shape of JSON bodies: keys and value types,
// never the values themselves.

export type Capture = { status: number | null; body: unknown }

export type RecordedResponse = { status: number; body: string }

// Replaces every leaf value with its JSON type label ("string", "number", ...).
// Arrays keep the shape of their first element only.
export function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? [shapeOf(value[0])] : []
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, shapeOf(v)]),
    )
  }
  return value === null ? "null" : typeof value
}

export function diffShapes(a: unknown, b: unknown, at = ""): string[] {
  if (typeof a === "string" || typeof b === "string" || a === undefined || b === undefined) {
    return a === b ? [] : [`${at || "(root)"}: fixture=${JSON.stringify(a)} live=${JSON.stringify(b)}`]
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b)
      ? a.length && b.length
        ? diffShapes(a[0], b[0], `${at}[]`)
        : []
      : [`${at}: array mismatch`]
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const out: string[] = []
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    if (!(k in ao)) out.push(`${at}.${k}: only in live`)
    else if (!(k in bo)) out.push(`${at}.${k}: only in fixture`)
    else out.push(...diffShapes(ao[k], bo[k], `${at}.${k}`))
  }
  return out
}

// Turns a recorded exchange response into a comparable capture. The recorded body
// is a string; non-JSON bodies are kept as text so only their type is compared.
export function captureFromExchange(response: RecordedResponse | undefined): Capture {
  if (!response) return { status: null, body: null }
  let body: unknown
  try {
    body = JSON.parse(response.body) as unknown
  } catch {
    body = response.body
  }
  return { status: response.status, body }
}

// Returns human-readable differences; an empty array means the structures match.
export function diffCapture(baseline: Capture, live: Capture): string[] {
  const statusDiffs =
    baseline.status === live.status
      ? []
      : [`status: baseline=${baseline.status} live=${live.status}`]
  return [...statusDiffs, ...diffShapes(shapeOf(baseline.body), shapeOf(live.body))]
}
