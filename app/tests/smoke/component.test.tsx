import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Button } from "@/components/ui/button"

describe("jsdom runner smoke", () => {
  it("renders a button reachable by role", () => {
    render(<Button>Send</Button>)
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
  })
})
