import { describe, expect, it } from 'vitest';
import { expectResponseToMatchContract } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

describe('GET /api/owner', () => {
  it('should return owner profile from backend config when requested', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({ method: 'GET', url: '/api/owner' });

    // then
    expect(response.statusCode).toBe(200);
    expect(expectResponseToMatchContract(response, 'Owner_get')).toEqual({
      name: 'Алия Нурланова',
      subtitle: 'Продуктовый дизайнер',
      timeZone: 'Asia/Almaty',
    });
  });
});
