import type { Metadata } from "next"
import { Atkinson_Hyperlegible, Bangers } from "next/font/google"

import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

const fontDisplay = Bangers({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-bangers",
})

const fontSans = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson",
})

export const metadata: Metadata = {
  title: "Hardware Service Decision Copilot",
  description:
    "Wstępna rekomendacja dotycząca zwrotu lub reklamacji sprzętu — szybko, jasno i po polsku.",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSans.variable} antialiased font-sans`}
    >
      <body>
        <ThemeProvider forcedTheme="light">
          <TooltipProvider>
            <div className="flex h-svh flex-col">
              <SiteHeader />
              {children}
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
