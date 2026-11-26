import { handleCasesRequest } from "@/server/cases/handle-cases"

// ADR-002 5: multipart in, NDJSON progress and one terminal event out. Budget: 90 s pipeline inside 120 s.
export const runtime = "nodejs"
export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  return handleCasesRequest(request)
}
