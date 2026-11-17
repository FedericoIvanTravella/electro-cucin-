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

## Funcionalidades extra

- **Correo de confirmación de compra**: tras pagar, se envía el detalle del pedido (ítems, totales, descuento 65+, cupón, dirección, entrega 24–48 h). Sin SMTP configurado se escribe en `BackEnd/data/outbox/*.json` (modo dev); con `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` se envía de verdad (ver `.env.example`).
- **Reseñas con estrellas**: solo compradores (con venta completada del producto) pueden valorar 1–5 estrellas con comentario; promedio real visible en cards y en el detalle (reemplaza el 4.8 fake anterior).
- **Cupones de descuento**: `COCINA10` (−10%) y `CUCINE5` (−$5.000) seedeados; se aplican en el pago y quedan registrados en la venta. En el panel superusuario → **Cupones** hay CRUD completo (crear, (des)activar, eliminar, usos máximos).
- **Exportar ventas a CSV**: en el panel superusuario → Registro de ventas → "Exportar CSV" (UTF-8 con BOM, separador `;`, ideal para Excel).
- **Repetir compra**: en Mis compras, un clic vacía el carrito y carga los ítems de ese pedido (con stock y precio actual).
- **Buscador con autosugerencia**: al escribir en el catálogo (mín. 2 letras) aparece un desplegable con coincidencias (teclado: ↑ ↓ Enter, Esc).
- **Animaciones**: apariciones escalonadas al hacer scroll, marquee de promos, página con fade, botones con press, corazón que hace "pop" al favoritear, camiones animados (mis compras / éxito de pago) y transiciones respetando `prefers-reduced-motion`.
- **PWA**: `manifest.webmanifest` + service worker — se puede 'Instalar' en el celu/PC y abrir offline (las páginas cacheadas funcionan sin internet).
- **Estados del pedido con mails automáticos**: el admin puede marcar cada pedido como **en camino** o **entregado** desde el panel; al hacerlo se le envía un mail automático al comprador y se registra en Auditoría.
- **Alerta de poco stock por mail**: al hacer una venta que deja ≤5 unidades, el admin recibe un aviso por correo con el producto y cantidad.
- **Aviso de vuelta de stock**: si un producto está agotado, el cliente puede dejar su correo (botón "Avisame cuando vuelva"); cuando el admin reabastece, se le avisa por mail automáticamente.
- **Newsletter**: form en el footer para suscribirse; la cantidad de suscriptores figura como indicador en el panel admin → Resumen.

## Estructura

```
BackEnd/            API Express 5 (ESM)
  index.js          Punto de entrada (exporta app; escucha solo si es main)
  src/db.js         Conexión, esquema, migraciones, helpers de edad/descuento
  src/seed.js       Seed (superusuario por env + catálogo); `npm run seed`
  src/catalogo.js   Catálogo inicial de 100 productos
  src/auth.js       Sesiones (tokens SHA-256), middlewares requerirAuth/Admin
  src/seguridad.js  Rate limit de login, política de contraseñas, CSRF
  src/correo.js     Envío de correos (SMTP u outbox JSON en dev) y plantilla HTML
  src/routes/       auth, productos, clientes, ventas, cupones
  public/productos/ Imágenes: solo 1-5 tienen foto; el resto se muestra con ícono por defecto
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
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_SECURE=1` (correo real; sin ellos se usa outbox JSON en `BackEnd/data/outbox/`)

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

## Imágenes y créditos

- Productos 1–5: fotos en `public/productos/*.jpg`.
- Productos con foto elegida por el dueño: 7, 8, 10, 11, 13, 23, 31, 40, 82 y 98 (mapa `src/imagenes-reales.json`).
- El resto no lleva imagen a propósito (se muestra un ícono vectorial por defecto). Podés asignar cualquier imagen desde el panel del superusuario.
- **Íconos**: [Flaticon UIcons](https://www.flaticon.com/uicons) vía el paquete oficial `@flaticon/flaticon-uicons` (uso gratuito con atribución, incluida en el footer del sitio).

## Ofertas y descuentos

No todos los productos llevan oferta: **cada 3er producto** (id múltiplo de 3) se muestra a precio normal. El resto trae `precio_tachado` > precio con el % OFF correspondiente. Se puede editar producto por producto desde el panel del superusuario.

## Notas de higiene del repo

- `node_modules/`, `BackEnd/data/*.db*` y `dist/` **no** se versionan (antes sí; ver historial inicial).

