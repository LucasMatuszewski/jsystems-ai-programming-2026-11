import type { Metadata } from "next"

import { HomeScreen } from "@/components/case-flow/home-screen"

export const metadata: Metadata = {
  title: "Zgłoś zwrot lub reklamację — Hardware Service Decision Copilot",
}

export default function Page() {
  return <HomeScreen />
}
