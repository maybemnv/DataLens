# ============================================================
# Stage 1: Build  — install deps + compile Next.js static export
# ============================================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the Next.js app (produces out/ for static export)
RUN npm run build

# ============================================================
# Stage 2: Runner  — serve static files via nginx
# ============================================================
FROM nginx:1.27-alpine AS runner

# Copy built static site from builder stage
COPY --from=builder /app/out /usr/share/nginx/html

# Copy Cloudflare Pages SPA fallback for self-hosted nginx
# (separate from _redirects which is for Cloudflare Pages)
RUN echo 'try_files $uri $uri/ /index.html =404;' > /etc/nginx/conf.d/default.conf && \
    echo 'server { listen 3000; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html =404; } }' > /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

# Healthcheck — checks for index.html served at root
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1
