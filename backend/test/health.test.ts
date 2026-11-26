import { describe, expect, it } from 'vitest';
import { expectResponseToMatchContract } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

describe('GET /api/health', () => {
  it('should respond 200 with status ok when app is started', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    // then
    expect(response.statusCode).toBe(200);
    expect(expectResponseToMatchContract(response, 'HealthCheck_check')).toEqual({ status: 'ok' });
  });
});
