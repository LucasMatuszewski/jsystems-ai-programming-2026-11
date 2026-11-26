import Link from "next/link"
import Image from "next/image"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-[79px] shrink-0 items-center border-b-[3px] border-hairline bg-surface px-4 sm:px-6">
      <Link
        href="/"
        aria-label="Hardware Service Decision Copilot — strona główna"
        className="flex min-w-0 flex-1 items-center gap-3 text-on-surface no-underline"
      >
        <Image
          src="/logo.svg"
          alt="DevPowers"
          width={158}
          height={35}
          priority
          className="h-auto w-[88px] shrink-0 sm:w-[158px]"
        />
        <span className="line-clamp-3 min-w-0 font-display text-[14px] leading-[0.95] tracking-[0.02em] sm:text-2xl">
          Hardware Service Decision Copilot
        </span>
      </Link>
    </header>
  )
}
