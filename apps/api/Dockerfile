FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

# Copy root prisma schema for generation
COPY prisma ./prisma/

# Copy api package files
COPY apps/api/package*.json ./apps/api/
COPY apps/api/tsconfig*.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/

WORKDIR /app/apps/api
RUN npm install

# Copy api source
COPY apps/api/src ./src

# Generate prisma client
RUN npx prisma generate --schema=../../prisma/schema.prisma && \
    cp -r /app/node_modules/.prisma /app/apps/api/node_modules/ 2>/dev/null || true

# Build nestjs
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install docker CLI and openssl
RUN apk add --no-cache docker-cli openssl

COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

CMD ["node", "dist/main.js"]
