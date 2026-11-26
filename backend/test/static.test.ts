import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectBodyToMatchSchema } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

const INDEX_HTML = '<!doctype html><title>Календарь</title>';
const ASSET_JS = 'console.log("app");';

// Собранный фронтенд подменяется минимальной папкой: тесту важна маршрутизация, а не сборка
let staticDir: string;

beforeAll(async () => {
  staticDir = await mkdtemp(join(tmpdir(), 'calendar-static-'));
  await mkdir(join(staticDir, 'assets'));
  await writeFile(join(staticDir, 'index.html'), INDEX_HTML);
  await writeFile(join(staticDir, 'assets', 'app.js'), ASSET_JS);
});

afterAll(async () => {
  await rm(staticDir, { recursive: true, force: true });
});

describe('Раздача собранного фронтенда', () => {
  it('should respond JSON 404 NOT_FOUND when api address is unknown and static is enabled', async () => {
    // given
    const app = buildTestApp({ staticDir });

    // when
    const response = await app.inject({ method: 'GET', url: '/api/no-such-route' });

    // then
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(expectBodyToMatchSchema(response, 'ApiError')).toEqual({
      code: 'NOT_FOUND',
      message: 'Адрес не найден',
    });
  });

  it('should respond JSON 404 NOT_FOUND when api root is requested and static is enabled', async () => {
    // given
    const app = buildTestApp({ staticDir });

    // when
    const response = await app.inject({ method: 'GET', url: '/api' });

    // then
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'NOT_FOUND', message: 'Адрес не найден' });
  });

  it('should serve api routes when static is enabled', async () => {
    // given
    const app = buildTestApp({ staticDir });

    // when
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    // then
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('should serve index.html when page address is requested', async () => {
    // given
    const app = buildTestApp({ staticDir });

    // when
    const responses = await Promise.all(
      ['/', '/book', '/book/intro-15', '/admin', '/no-such-page'].map((url) =>
        app.inject({ method: 'GET', url }),
      ),
    );

    // then
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/^text\/html/);
      expect(response.body).toBe(INDEX_HTML);
    }
  });

  it('should serve built asset when its file exists', async () => {
    // given
    const app = buildTestApp({ staticDir });

    // when
    const response = await app.inject({ method: 'GET', url: '/assets/app.js' });

    // then
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/javascript/);
    expect(response.body).toBe(ASSET_JS);
  });

  it('should respond JSON 404 NOT_FOUND when page address is requested with non-GET method', async () => {
    // given
    const app = buildTestApp({ staticDir });

    // when
    const response = await app.inject({ method: 'POST', url: '/book', payload: {} });

    // then
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'NOT_FOUND', message: 'Адрес не найден' });
  });

  it('should respond JSON 404 NOT_FOUND for page address when static is disabled', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({ method: 'GET', url: '/book/intro-15' });

    // then
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'NOT_FOUND', message: 'Адрес не найден' });
  });
});
