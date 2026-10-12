# Game Tracker: one image with the API and the built frontend (decision #89).
# The API serves the frontend, so the app is a single service on one origin.

# --- Frontend build ------------------------------------------------------------
FROM node:24-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Public build-time values (never secrets): they end up in the browser bundle.
ARG VITE_CONTACT_EMAIL=""
ENV VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL \
    VITE_API_BASE_URL=/api
RUN npm run build

# --- Backend build ---------------------------------------------------------------
FROM node:24-slim AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# --- Runtime ---------------------------------------------------------------------
FROM node:24-slim
ENV NODE_ENV=production \
    FRONTEND_DIST_DIR=/app/frontend-dist \
    DB_MIGRATIONS_RUN=true \
    ASSET_STORAGE_LOCAL_DIR=/data/storage \
    TRUST_PROXY_HOPS=1
WORKDIR /app/backend
COPY --from=backend /app/backend/package.json ./
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=frontend /app/frontend/dist /app/frontend-dist
# Covers and avatars live on the persistent volume mounted at /data.
RUN mkdir -p /data/storage
EXPOSE 3000
CMD ["node", "dist/main"]
