import { handleChatRequest } from "@/server/ai/chat/handle-chat"

// ADR-002 5: case chat turn as a UI message stream. Budget: 60 s model timeout inside 90 s.
export const runtime = "nodejs"
export const maxDuration = 90
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  return handleChatRequest(request)
}
