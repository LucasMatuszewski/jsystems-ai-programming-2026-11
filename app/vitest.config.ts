import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const root = path.dirname(fileURLToPath(import.meta.url))
const alias = { "@": root }

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/unit/**/*.test.ts",
            "tests/integration/**/*.test.ts",
            "tests/smoke/node*.test.ts",
          ],
          setupFiles: ["tests/setup/node.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: [
            "tests/component/**/*.test.{ts,tsx}",
            "tests/smoke/component*.test.tsx",
          ],
          setupFiles: ["tests/setup/jsdom.ts"],
        },
      },
    ],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
})
