# Multi-stage build para Ads Finder Pro
# Etapa 1: Build del Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copiar package files del frontend
COPY frontend/package*.json ./
RUN npm ci --only=production

# Copiar código del frontend y build
COPY frontend/ ./
RUN npm run build

# Etapa 2: Build del Backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copiar package files del backend
COPY backend/package*.json ./
RUN npm ci --only=production

# Copiar código del backend
COPY backend/ ./
COPY shared/ ../shared/

# Compilar TypeScript
RUN npm run build

# Etapa 3: Producción - Imagen final
FROM node:18-alpine AS production

# Instalar dependencias del sistema para Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Variables de entorno para Playwright
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium-browser

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copiar dependencias del backend desde builder
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/package*.json ./

# Copiar shared types
COPY --from=backend-builder /app/shared ./shared

# Copiar frontend build (será servido por Express)
COPY --from=frontend-builder /app/frontend/dist ./public

# Copiar archivo de variables de entorno (template)
COPY .env.example .env.example

# Crear directorios necesarios
RUN mkdir -p logs temp && \
    chown -R nextjs:nodejs /app

# Cambiar a usuario no-root
USER nextjs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Comando de inicio
CMD ["node", "dist/server.js"]
