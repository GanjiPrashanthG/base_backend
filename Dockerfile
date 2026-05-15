# syntax=docker/dockerfile:1.7

############################################
# Base
############################################
FROM node:26-alpine AS base

WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV HUSKY=0

############################################
# Dependencies (dev + prod — required for build)
############################################
FROM base AS deps

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

############################################
# Production dependencies (parallel with builder)
############################################
FROM base AS prod-deps

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund

############################################
# Builder
############################################
FROM deps AS builder

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build && find dist -name '*.map' -delete

############################################
# Production runner (ECS Fargate)
############################################
FROM base AS runner

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV NODE_OPTIONS="--max-old-space-size=256"

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/server.js"]
