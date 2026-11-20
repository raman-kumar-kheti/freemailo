FROM node:24.15-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY apps/api/package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma
COPY apps/api/tsconfig*.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
RUN npm run build

FROM builder AS production-deps
RUN npm prune --omit=dev

FROM node:24.15-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=4000
RUN apk add --no-cache openssl && addgroup -g 5000 mailhive && adduser -D -u 5000 -G mailhive mailhive
COPY --from=production-deps --chown=5000:5000 /app/node_modules ./node_modules
COPY --from=builder --chown=5000:5000 /app/dist ./dist
COPY --from=builder --chown=5000:5000 /app/prisma ./prisma
COPY --from=builder --chown=5000:5000 /app/package*.json ./
COPY --chown=5000:5000 scripts/create-admin.cjs ./scripts/create-admin.cjs
USER 5000:5000
EXPOSE 4000
CMD ["node", "dist/main.js"]
