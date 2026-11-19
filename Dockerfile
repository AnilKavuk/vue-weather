# ------------------------------------------------------------
# Stage 1: Builder (dependencies + build)
# ------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Package files first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Source copy — host node_modules/.next/.env* icin .dockerignore'a bakin
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
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output + static assets + public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Next.js runtime'da .next/cache'e yazar; standalone cikti bu dizini icermez
# ve container non-root calistigi icin dizin onceden olusturulmali.
RUN mkdir -p .next/cache \
    && chown nextjs:nodejs .next .next/cache

USER nextjs

EXPOSE 3000

# Health check endpoint: app/api/health/route.ts
# Not: busybox wget `--no-verbose` / `--tries` bayraklarini desteklemez, bu yuzden
# probe node'un global fetch'i ile yapiliyor. Ayrica `localhost` ::1'e cozulebilir,
# Next.js ise IPv4'e bind oldugundan adres 127.0.0.1 olarak sabit.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
