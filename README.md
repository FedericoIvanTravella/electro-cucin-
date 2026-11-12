# Electro Cuciné

E-commerce de electrodomésticos de cocina. API REST en **Express 5 + SQLite** (`node:sqlite`, sin binarios externos) y frontend en **React 19 + Vite**.

## Requisitos

- **Node.js ≥ 22.5** (se usa `node:sqlite`; en desarrollo se probó con Node 26)
- npm ≥ 10

## Inicio rápido

```bash
# 1. Instalar dependencias de backend y frontend
npm run install:all

# 2a. Desarrollo (dos terminales)
npm run dev:backend    # API en http://localhost:3001 (node --watch)
npm run dev:frontend   # Vite en http://localhost:5173 (proxy a la API)

# 2b. Producción de un solo proceso
npm run build          # compila el frontend a FrontEnd/client/dist
npm start              # la API sirve también el build (http://localhost:3001)
```

El superusuario se crea **en el primer arranque** desde variables de entorno (ver `.env.example`). Si `ADMIN_PASSWORD` está vacía, se genera una aleatoria y **se muestra una sola vez por consola**.

## Scripts (raíz)

| Script             | Qué hace                                              |
| ------------------ | ----------------------------------------------------- |
| `dev:backend`      | API con `node --watch`                                |
| `dev:frontend`     | Vite dev server (5173) con proxy `/api` → 3001        |
| `build`            | Build de producción del frontend                       |
| `start`            | Arranca el backend (sirve `dist/` si existe)           |
| `lint`             | ESLint en backend y frontend                           |
| `test`             | Tests del backend (node:test + supertest)              |
| `seed`             | Reejecuta el seed (superusuario + catálogo si vacío)   |
| `install:all`      | Instala deps de backend y frontend                     |

## Estructura

```
BackEnd/            API Express 5 (ESM)
  index.js          Punto de entrada (exporta app; escucha solo si es main)
  src/db.js         Conexión, esquema, migraciones, helpers de edad/descuento
  src/seed.js       Seed (superusuario por env + catálogo); `npm run seed`
  src/catalogo.js   Catálogo inicial de 100 productos
  src/auth.js       Sesiones (tokens SHA-256), middlewares requerirAuth/Admin
  src/seguridad.js  Rate limit de login, política de contraseñas, CSRF
  src/routes/       auth, productos, clientes, ventas
  public/productos/ Imágenes: 1-5 jpg reales + 95 placeholders SVG generados
  test/             Tests de API (base :memory:)
FrontEnd/client/    React 19 + Vite (SPA)
  src/pages/        Home, catálogo, Producto (detalle), carrito, pago, admin…
  src/context/      Auth, Cart, Favoritos, Tema, Toast
  src/lib/          api (fetch + CSRF), format (precios, fechas)
scripts del repo
  .gitignore/.gitattributes    (data/ y node_modules fuera del repo)
```

## Variables de entorno

Ver **`.env.example`**. Lo esencial:

- `PORT` (3001), `NODE_ENV` (`production` activa cookies `Secure`)
- `CORS_ORIGINS` (lista separada por comas)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NOMBRE` / `ADMIN_EMAIL` (creación del superusuario la **primera** vez)
- `TRUST_PROXY=1` si hay proxy inverso (para IPs reales en el rate limit)
- `EC_DB_PATH` (ruta de la base; los tests usan `:memory:`)

El backend carga `.env` (raíz del repo y/o `BackEnd/.env`) **sin dependencias** usando `process.loadEnvFile`; las variables ya presentes en el entorno tienen prioridad.

## Seguridad

- Contraseñas con **bcrypt** (costo 10); sesión en cookie `httpOnly`; el token se guarda **hasheado (SHA-256)** en la tabla `sesiones` (migración automática de tokens viejos).
- Las peticiones que modifican datos exigen **CSRF** (double-submit cookie + header `X-CSRF-Token`).
- Rate limit en memoria para login (5 fallos → 15 min de bloqueo; purga de entradas viejas incluida).
- Auditoría de acciones sensibles (`auditoria`), visible en el panel del superusuario.
- CORS restringido por lista; helmet con CSP; `express.json` con límite de 100 KB.
- **Fix crítico incluido**: `GET /api/productos?admin=1` exige rol admin (antes era público y exponía productos ocultos).

## Docker

```bash
docker build -t electro-cucine .
docker run -p 3001:3001 -v ec-data:/app/BackEnd/data electro-cucine
# o simplemente: docker compose up --build
```

Imagen todo-en-uno: compila el frontend, instala deps de producción del backend y sirve ambos (API + SPA) en el puerto 3001. Los datos persisten en el volumen `/app/BackEnd/data`.

## CI

## Imágenes y créditos
- **Íconos**: [Flaticon UIcons](https://www.flaticon.com/uicons) vía el paquete oficial `@flaticon/flaticon-uicons` (uso gratuito con atribución, incluida en el footer del sitio).
## Estado de la base de datos local

El seed no toca datos existentes. Si tu base venía de una versión anterior con `federico / admin23`, **cambiale la contraseña** cuanto antes (esa cuenta ya no se crea en instalaciones nuevas). Las sesiones viejas se invalidan solas tras el hasheo de tokens (hay que volver a iniciar sesión).
