# ─────────────────────────────────────────────────────────────
# CloudGuard Security Analyzer — Dockerfile
# Multi-stage build for small, secure production image.
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ──────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: Production image ─────────────────────────────
FROM node:18-alpine AS production
WORKDIR /app

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY samples/ ./samples/
COPY scripts/ ./scripts/

# Set ownership
RUN chown -R appuser:appgroup /app
USER appuser

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/health-check.js http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
