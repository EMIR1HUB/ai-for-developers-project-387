import type { FastifyInstance } from 'fastify';
import { afterEach } from 'vitest';
import { buildApp, type AppOptions } from '../../src/app.ts';

/** Фиксированный момент для тестов: вторник, 24 ноября 2026, 10:00 по Алматы */
export const FIXED_NOW = new Date('2026-11-24T10:00:00+05:00');

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

/**
 * Приложение для API-тестов: фиксированные часы, пустое хранилище, без демо-данных.
 * Любую опцию можно переопределить; приложение закрывается после теста.
 */
export function buildTestApp(options: AppOptions = {}): FastifyInstance {
  const app = buildApp({ now: () => FIXED_NOW, demoData: false, ...options });
  openApps.push(app);
  return app;
}
