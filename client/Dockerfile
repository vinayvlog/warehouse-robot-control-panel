# --- Build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
# Baked in at build time: the browser needs a real ws:// URL it can reach,
# which docker-compose supplies via a build arg (see docker-compose.yml).
ARG VITE_ROBOT_WS_URL=ws://localhost:8080
ENV VITE_ROBOT_WS_URL=$VITE_ROBOT_WS_URL
RUN npx vite build

# --- Serve stage ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
    CMD wget -q -O- http://localhost/ >/dev/null || exit 1
