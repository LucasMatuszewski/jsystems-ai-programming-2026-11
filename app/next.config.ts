import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

// The real OPENROUTER_API_KEY lives in the repository-root .env. Next only
// loads env files from app/, so load the root one here. process.loadEnvFile
// never overrides existing variables, so app/.env.local (already loaded by
// Next) and the shell environment still win. Values are never printed.
const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".env"
)
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      clsx: "cn",
      "tailwind-merge": "cn",
    },
  },
}

export default nextConfig
