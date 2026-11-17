import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

for (const ruta of [
  path.join(__dirname, '..', '..', '.env'), 
  path.join(__dirname, '..', '.env') 
]) {
  try {
    process.loadEnvFile(ruta)
  } catch { void 0 }
}
