# ===== ADS FINDER PRO - PRODUCTION DOCKERFILE =====
# Optimized multi-stage build for Easypanel deployment

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install && npm cache clean --force
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install && npm cache clean --force
COPY backend/ ./
COPY backend/.env.example ./.env
RUN npm run build

# Stage 3: Production runtime
FROM node:18-alpine AS production
WORKDIR /app

# No need for Playwright dependencies - using HTTP + Gemini AI

# Install production dependencies for backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --only=production && npm cache clean --force

# Copy built applications
WORKDIR /app
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/.env ./.env
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy package.json for start script
COPY package.json ./

# Set Docker environment variable like Evolution API
ENV DOCKER_ENV=true

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

USER nextjs

# Expose port (Easypanel will handle port mapping)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["npm", "start"]