# syntax=docker/dockerfile:1

# Версия Node совпадает с mise.toml: образ ведёт себя как локальное окружение
ARG NODE_VERSION=24.22.3

# Сборка фронтенда. Нужны все dev-зависимости: генератор SDK (Hey API) и Vite
FROM node:${NODE_VERSION}-slim AS frontend-build
WORKDIR /app

# npm ci сверяет lock-файл со всеми workspace, поэтому нужны package.json каждого из них
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN npm ci --workspace=@calendar/frontend

# SDK не хранится в git: его генерирует Hey API из закоммиченного api/openapi.yaml
COPY api/openapi.yaml api/
COPY frontend frontend
RUN npm run generate -w @calendar/frontend && npm run build -w @calendar/frontend

# Прод-зависимости бэкенда: только fastify и @fastify/static
FROM node:${NODE_VERSION}-slim AS backend-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN npm ci --omit=dev --workspace=@calendar/backend

# Итоговый образ: Node запускает .ts напрямую (type stripping), сборки бэкенда нет
FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production
# Абсолютный путь: относительный STATIC_DIR считается от рабочей папки процесса
ENV STATIC_DIR=/app/frontend/dist
WORKDIR /app

COPY --from=backend-deps /app/node_modules node_modules
COPY package.json ./
COPY backend/package.json backend/
COPY backend/src backend/src
COPY --from=frontend-build /app/frontend/dist frontend/dist

# Порт читается из переменной PORT (по умолчанию 3000), слушается 0.0.0.0.
# Render задаёт PORT=10000 сам, поэтому порт в образе не фиксируется
EXPOSE 3000
USER node
CMD ["node", "backend/src/server.ts"]
