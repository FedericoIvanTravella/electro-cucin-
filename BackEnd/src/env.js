// =====================================================================
// Carga opcional de .env SIN dependencias (Node >= 20.12).
// Debe importarse PRIMERO, antes que cualquier módulo que lea process.env
// (por eso index.js lo importa como primera línea).
// Orden: raíz del repo, después BackEnd/.env. Las variables ya presentes
// en el entorno NO se pisan (gana el entorno).
// =====================================================================
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

for (const ruta of [
  path.join(__dirname, '..', '..', '.env'), // raíz del repo
  path.join(__dirname, '..', '.env') // BackEnd/.env
]) {
  try {
    process.loadEnvFile(ruta)
  } catch {
    // No existe (o no se puede leer): se sigue con las variables del entorno.
  }
}
