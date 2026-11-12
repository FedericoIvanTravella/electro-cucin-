# ================================================================
# Electro Cuciné — imagen de producción todo-en-uno
# 1) compila el frontend (Vite), 2) instala deps del backend,
# 3) sirve API + SPA estática desde un solo proceso Node.
# Build:  docker build -t electro-cucine .
# Run:    docker run -p 3001:3001 -v ec-data:/app/BackEnd/data electro-cucine
# ================================================================

# ---------- Etapa 1: build del frontend ----------
FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY FrontEnd/client/package.json FrontEnd/client/package-lock.json ./
RUN npm ci
COPY FrontEnd/client/ ./
RUN npm run build

# ---------- Etapa 2: backend + frontend compilado ----------
FROM node:24-bookworm-slim AS app
ENV NODE_ENV=production
WORKDIR /app

# Backend en /app/BackEnd: index.js resuelve el build como
# /app/FrontEnd/client/dist (relativo a su ubicación, igual que en el repo).
COPY BackEnd/package.json BackEnd/package-lock.json ./BackEnd/
RUN cd BackEnd && npm ci --omit=dev
COPY BackEnd/ ./BackEnd
COPY --from=frontend /build/dist ./FrontEnd/client/dist

EXPOSE 3001
VOLUME ["/app/BackEnd/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/BackEnd
CMD ["node", "index.js"]
