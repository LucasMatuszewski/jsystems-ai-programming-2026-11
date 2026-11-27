import type { Metadata } from "next"

import { ChatScreen } from "@/components/case-flow/chat-screen"

export const metadata: Metadata = {
  title: "Rozmowa — Hardware Service Decision Copilot",
}

export default function Page() {
  return <ChatScreen />
}
