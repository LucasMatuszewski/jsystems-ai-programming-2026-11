import type { Metadata } from "next"

import { Chat } from "@/components/chat"

export const metadata: Metadata = {
  title: "Chat",
  description: "Streaming chat powered by OpenRouter.",
}

export default function Page() {
  return <Chat />
}
