import { describe, expect, it } from 'vitest';
import { createStore } from '../src/store.ts';
import { expectResponseToMatchContract } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

describe('GET /api/event-types', () => {
  it('should return event types in creation order when several were created', async () => {
    // given
    const store = createStore();
    store.addEventType({
      id: 'zoom-60',
      title: 'Созвон на час',
      description: 'Подробный разбор задачи',
      durationMinutes: 60,
    });
    store.addEventType({
      id: 'a-15',
      title: 'Короткий звонок',
      description: '',
      durationMinutes: 15,
    });
    store.addEventType({
      id: 'm-30',
      title: 'Встреча',
      description: 'Обсуждение',
      durationMinutes: 30,
    });
    const app = buildTestApp({ store });

    // when
    const response = await app.inject({ method: 'GET', url: '/api/event-types' });

    // then
    expect(response.statusCode).toBe(200);
    expect(expectResponseToMatchContract(response, 'EventTypes_list')).toEqual([
      {
        id: 'zoom-60',
        title: 'Созвон на час',
        description: 'Подробный разбор задачи',
        durationMinutes: 60,
      },
      { id: 'a-15', title: 'Короткий звонок', description: '', durationMinutes: 15 },
      { id: 'm-30', title: 'Встреча', description: 'Обсуждение', durationMinutes: 30 },
    ]);
  });

  it('should return empty list when demo data is disabled and nothing was created', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({ method: 'GET', url: '/api/event-types' });

    // then
    expect(response.statusCode).toBe(200);
    expect(expectResponseToMatchContract(response, 'EventTypes_list')).toEqual([]);
  });

  it('should return demo event types intro-15 and call-30 when demo data is enabled', async () => {
    // given
    const app = buildTestApp({ demoData: true });

    // when
    const response = await app.inject({ method: 'GET', url: '/api/event-types' });

    // then
    expect(response.statusCode).toBe(200);
    const body = expectResponseToMatchContract(response, 'EventTypes_list') as Array<{
      id: string;
      title: string;
    }>;
    expect(body.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'intro-15', title: 'Встреча 15 минут' },
      { id: 'call-30', title: 'Встреча 30 минут' },
    ]);
  });
});

describe('GET /api/event-types/{id}', () => {
  it('should return event type when it exists', async () => {
    // given
    const store = createStore();
    store.addEventType({
      id: 'call-30',
      title: 'Встреча 30 минут',
      description: 'Подробный разговор',
      durationMinutes: 30,
    });
    const app = buildTestApp({ store });

    // when
    const response = await app.inject({ method: 'GET', url: '/api/event-types/call-30' });

    // then
    expect(response.statusCode).toBe(200);
    expect(expectResponseToMatchContract(response, 'EventTypes_get')).toEqual({
      id: 'call-30',
      title: 'Встреча 30 минут',
      description: 'Подробный разговор',
      durationMinutes: 30,
    });
  });

  it('should respond 404 EVENT_TYPE_NOT_FOUND when event type does not exist', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({ method: 'GET', url: '/api/event-types/unknown-type' });

    // then
    expect(response.statusCode).toBe(404);
    expect(expectResponseToMatchContract(response, 'EventTypes_get')).toEqual({
      code: 'EVENT_TYPE_NOT_FOUND',
      message: 'Тип встречи не найден',
    });
  });
});
