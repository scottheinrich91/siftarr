# ==========================================
# 1. Build the Frontend React Application
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json ./
COPY frontend/package.json ./frontend/
RUN npm install --workspace=frontend --include=dev
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

# ==========================================
# 2. Build the Backend Express Application
# ==========================================
FROM node:20-alpine AS server-builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY server/package.json ./server/
RUN npm install --workspace=server --include=dev
COPY server/ ./server/
RUN npm run build --workspace=server

# ==========================================
# 3. Production Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SIFTARR_CONFIG_DIR=/config
ENV PORT=8080

RUN mkdir -p /config && chown -R node:node /config

# Copy production package structures and install only production dependencies
COPY package.json ./
COPY server/package.json ./server/
RUN npm install --workspace=server --only=production

# Copy built server files and assets
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/src/db/migrations ./server/dist/db/migrations
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080
VOLUME [ "/config" ]

USER node

CMD [ "node", "server/dist/index.js" ]
