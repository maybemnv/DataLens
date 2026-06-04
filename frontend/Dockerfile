# ============================================================
# Stage 1: Build  — install deps + compile Next.js
# ============================================================
FROM node:20-slim AS builder

WORKDIR /app

# Install build deps if needed (e.g., sharp for image optimization)
# RUN apt-get update && apt-get install -y --no-install-recommends ...

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies (--frozen-lockfile ensures lockfile integrity)
RUN npm ci --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the Next.js app (produces .next/standalone)
RUN npm run build

# ============================================================
# Stage 2: Runner  — minimal production image
# ============================================================
FROM node:20-slim AS runner

ENV NODE_ENV=production

WORKDIR /app

# Copy standalone build (includes node_modules pruned to production only)
COPY --from=builder /app/.next/standalone ./

# Copy static assets (not included in standalone)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Expose port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the standalone server
CMD ["node", "server.js"]
