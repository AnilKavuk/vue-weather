# ------------------------------------------------------------
# Stage 1: Builder (dependencies + build)
# ------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Package files first (cache layer)
COPY package*.json ./
RUN npm ci --include=dev

# Source copy
COPY . .

# Build (standalone output üretir)
RUN npm run build

# ------------------------------------------------------------
# Stage 2: Runner (production only)
# ------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Next.js PORT env'ini okur, default 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output + static assets + public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Health check endpoint'i Next.js'e ekleyin (app/api/health/route.ts)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]