import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { seedDemoData } from './demoData.ts';
import { ApiFailure, sendError } from './errors.ts';
import type { Health } from './generated/types.gen.ts';
import { registerBookingRoutes } from './routes/bookings.ts';
import { registerEventTypeRoutes } from './routes/eventTypes.ts';
import { registerOwnerRoutes } from './routes/owner.ts';
import { createStore, type Store } from './store.ts';
import { MALFORMED_BODY_MESSAGE } from './validation.ts';

/** Часы приложения: «сейчас» берётся только из них, чтобы тесты могли зафиксировать время */
export type Clock = () => Date;

export interface AppOptions {
  /** По умолчанию системные часы */
  now?: Clock;
  /** Создать демо-типы встреч при старте. По умолчанию включено */
  demoData?: boolean;
  /** По умолчанию новое пустое хранилище в памяти */
  store?: Store;
  /**
   * Папка собранного фронтенда (`frontend/dist`). Если задана, сервер раздаёт её файлы,
   * а адреса страниц вне `/api` отдают `index.html`. По умолчанию раздачи нет
   */
  staticDir?: string;
}

/** Зависимости, которые получают маршруты */
export interface AppContext {
  store: Store;
  now: Clock;
}

function isClientError(error: unknown): boolean {
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const context: AppContext = {
    store: options.store ?? createStore(),
    now: options.now ?? (() => new Date()),
  };

  if (options.demoData ?? true) {
    seedDemoData(context.store);
  }

  // Встроенный формат ошибок Fastify наружу не выходит: любой ответ с ошибкой — в общей схеме
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiFailure) {
      return sendError(reply, error.code, error.message, error.fields);
    }
    // Ошибки клиента со статусом 4xx бросает только сам Fastify, когда не может прочитать тело
    // (битый или пустой JSON, неизвестный Content-Type, слишком большое тело)
    if (isClientError(error)) {
      request.log.warn({ err: error }, 'MALFORMED_REQUEST');
      return sendError(reply, 'MALFORMED_REQUEST', MALFORMED_BODY_MESSAGE);
    }
    request.log.error({ err: error }, 'UNHANDLED_ERROR');
    return sendError(reply, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера. Попробуйте позже');
  });

  app.get('/api/health', async (): Promise<Health> => ({ status: 'ok' }));
  registerOwnerRoutes(app);
  registerEventTypeRoutes(app, context);
  registerBookingRoutes(app, context);

  // Обработчик 404 в Fastify действует в пределах префикса плагина: неизвестный адрес под `/api`
  // всегда получает JSON, даже когда остальные адреса уходят в index.html
  app.register(async (api) => api.setNotFoundHandler(sendNotFound), { prefix: '/api' });

  if (options.staticDir) {
    serveFrontend(app, options.staticDir);
  } else {
    app.setNotFoundHandler(sendNotFound);
  }

  return app;
}

function sendNotFound(_request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return sendError(reply, 'NOT_FOUND', 'Адрес не найден');
}

function serveFrontend(app: FastifyInstance, staticDir: string): void {
  // wildcard: false — маршруты только на файлы, которые есть в папке при старте. С wildcard
  // плагин сам перехватывал бы все адреса, и неизвестный `/api/*` получал бы index.html
  app.register(fastifyStatic, { root: resolve(staticDir), wildcard: false });
  // Адреса страниц (`/book/<id>`, `/admin`) разбирает роутер фронтенда, поэтому сервер отдаёт
  // на них index.html. Остальные методы на неизвестный адрес — обычный JSON 404
  app.setNotFoundHandler((request, reply) =>
    request.method === 'GET' || request.method === 'HEAD'
      ? reply.sendFile('index.html')
      : sendNotFound(request, reply),
  );
}
