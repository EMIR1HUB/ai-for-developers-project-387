import { describe, expect, it } from 'vitest';
import { expectBodyToMatchSchema } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

describe('Ошибки в общей схеме', () => {
  it('should respond 404 NOT_FOUND when api address is unknown', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({ method: 'GET', url: '/api/no-such-route' });

    // then
    expect(response.statusCode).toBe(404);
    expect(expectBodyToMatchSchema(response, 'ApiError')).toEqual({
      code: 'NOT_FOUND',
      message: 'Адрес не найден',
    });
  });

  it('should respond 500 INTERNAL_ERROR without details when handler throws', async () => {
    // given
    const app = buildTestApp();
    app.get('/api/test-failure', async () => {
      throw new Error('секретная подробность');
    });

    // when
    const response = await app.inject({ method: 'GET', url: '/api/test-failure' });

    // then
    expect(response.statusCode).toBe(500);
    expect(expectBodyToMatchSchema(response, 'ApiError')).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера. Попробуйте позже',
    });
  });
});
