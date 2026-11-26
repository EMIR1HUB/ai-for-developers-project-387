import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { createStore } from '../src/store.ts';
import { expectResponseToMatchContract } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

const CALL_60 = { id: 'call-60', title: 'Встреча на час', description: '', durationMinutes: 60 };
const CALL_30 = { id: 'call-30', title: 'Встреча 30 минут', description: '', durationMinutes: 30 };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Приложение с часами, которые тест переставляет: бронирования создаются через API заранее,
 * до начала рабочего дня, а список запрашивается позже, когда часть из них уже закончилась
 */
function buildAppWithClock() {
  const store = createStore();
  store.addEventType(CALL_60);
  store.addEventType(CALL_30);
  const clock = { now: new Date('2026-11-24T08:00:00+05:00') };
  const app = buildTestApp({ store, now: () => clock.now });
  return {
    app,
    setNow: (time: string) => {
      clock.now = new Date(time);
    },
  };
}

async function book(
  app: FastifyInstance,
  eventTypeId: string,
  start: string,
  guest: { guestName: string; guestEmail: string; note?: string },
): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    payload: { eventTypeId, start, ...guest },
  });
  expect(response.statusCode).toBe(201);
}

const ANNA = { guestName: 'Анна Смирнова', guestEmail: 'anna@example.com' };
const IVAN = { guestName: 'Иван Петров', guestEmail: 'ivan@example.com', note: 'Обсудить проект' };

describe('GET /api/bookings', () => {
  it('should return empty list when there are no bookings', async () => {
    // given
    const { app } = buildAppWithClock();

    // when
    const response = await app.inject({ method: 'GET', url: '/api/bookings' });

    // then
    expect(response.statusCode).toBe(200);
    expect(expectResponseToMatchContract(response, 'Bookings_list')).toEqual([]);
  });

  it('should return not yet ended bookings of all event types by start when some have ended', async () => {
    // given
    const { app, setNow } = buildAppWithClock();
    // Порядок создания намеренно не совпадает с порядком начала
    await book(app, 'call-60', '2026-11-25T11:00:00+05:00', IVAN);
    await book(app, 'call-60', '2026-11-24T09:00:00+05:00', ANNA);
    await book(app, 'call-30', '2026-11-24T14:00:00+05:00', IVAN);
    await book(app, 'call-30', '2026-11-24T10:00:00+05:00', ANNA);
    // 09:00–10:00 уже закончилось, 10:00–10:30 идёт прямо сейчас
    setNow('2026-11-24T10:15:00+05:00');

    // when
    const response = await app.inject({ method: 'GET', url: '/api/bookings' });

    // then
    expect(response.statusCode).toBe(200);
    expect(expectResponseToMatchContract(response, 'Bookings_list')).toEqual([
      {
        id: expect.stringMatching(UUID_PATTERN),
        eventType: { id: 'call-30', title: 'Встреча 30 минут', durationMinutes: 30 },
        start: '2026-11-24T10:00:00+05:00',
        end: '2026-11-24T10:30:00+05:00',
        guestName: 'Анна Смирнова',
        guestEmail: 'anna@example.com',
        createdAt: '2026-11-24T08:00:00+05:00',
      },
      {
        id: expect.stringMatching(UUID_PATTERN),
        eventType: { id: 'call-30', title: 'Встреча 30 минут', durationMinutes: 30 },
        start: '2026-11-24T14:00:00+05:00',
        end: '2026-11-24T14:30:00+05:00',
        guestName: 'Иван Петров',
        guestEmail: 'ivan@example.com',
        note: 'Обсудить проект',
        createdAt: '2026-11-24T08:00:00+05:00',
      },
      {
        id: expect.stringMatching(UUID_PATTERN),
        eventType: { id: 'call-60', title: 'Встреча на час', durationMinutes: 60 },
        start: '2026-11-25T11:00:00+05:00',
        end: '2026-11-25T12:00:00+05:00',
        guestName: 'Иван Петров',
        guestEmail: 'ivan@example.com',
        note: 'Обсудить проект',
        createdAt: '2026-11-24T08:00:00+05:00',
      },
    ]);
  });

  it('should exclude booking ending exactly now and include booking starting now when now is their boundary', async () => {
    // given
    const { app, setNow } = buildAppWithClock();
    await book(app, 'call-60', '2026-11-24T09:00:00+05:00', ANNA);
    await book(app, 'call-30', '2026-11-24T10:00:00+05:00', IVAN);
    setNow('2026-11-24T10:00:00+05:00');

    // when
    const response = await app.inject({ method: 'GET', url: '/api/bookings' });

    // then
    expect(response.statusCode).toBe(200);
    const bookings = expectResponseToMatchContract(response, 'Bookings_list') as {
      start: string;
      end: string;
    }[];
    expect(bookings.map(({ start, end }) => `${start}/${end}`)).toEqual([
      '2026-11-24T10:00:00+05:00/2026-11-24T10:30:00+05:00',
    ]);
  });
});
