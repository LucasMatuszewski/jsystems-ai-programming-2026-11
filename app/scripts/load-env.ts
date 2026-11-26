import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Loads app/.env.local first (wins), then the repository-root .env. Existing
// process.env values are never overridden and no value is ever printed.
const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, "..")

for (const file of [
  path.join(appDir, ".env.local"),
  path.join(appDir, "..", ".env"),
]) {
  if (fs.existsSync(file)) process.loadEnvFile(file)
}
