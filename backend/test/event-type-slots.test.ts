import { describe, expect, it } from 'vitest';
import { createStore, type Store } from '../src/store.ts';
import { expectResponseToMatchContract } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

interface SlotBody {
  start: string;
  end: string;
  available: boolean;
}

function storeWithEventType(durationMinutes: number): Store {
  const store = createStore();
  store.addEventType({
    id: 'call',
    title: 'Созвон',
    description: '',
    durationMinutes,
  });
  return store;
}

describe('GET /api/event-types/{id}/slots', () => {
  it('should return slots of whole booking window with +05:00 offset when now is fixed', async () => {
    // given: сейчас вторник, 24 ноября 2026, 10:00 по Алматы; тип встречи на 4 часа
    const app = buildTestApp({ store: storeWithEventType(240) });

    // when
    const response = await app.inject({ method: 'GET', url: '/api/event-types/call/slots' });

    // then
    expect(response.statusCode).toBe(200);
    const slots = expectResponseToMatchContract(response, 'EventTypes_listSlots') as SlotBody[];
    // Каждый из 14 дней окна: старты 09:00…14:00 — по 21 слоту, включая уже начавшиеся сегодня
    expect(slots).toHaveLength(14 * 21);
    expect(slots[0]).toEqual({
      start: '2026-11-24T09:00:00+05:00',
      end: '2026-11-24T13:00:00+05:00',
      available: false,
    });
    expect(slots.at(-1)).toEqual({
      start: '2026-12-07T14:00:00+05:00',
      end: '2026-12-07T18:00:00+05:00',
      available: true,
    });
    // Начавшиеся слоты (09:00…10:00 сегодня, включая начавшийся ровно сейчас) недоступны, остальные свободны
    const unavailable = slots.filter((slot) => !slot.available).map((slot) => slot.start);
    expect(unavailable).toEqual([
      '2026-11-24T09:00:00+05:00',
      '2026-11-24T09:15:00+05:00',
      '2026-11-24T09:30:00+05:00',
      '2026-11-24T09:45:00+05:00',
      '2026-11-24T10:00:00+05:00',
    ]);
  });

  it('should mark slots as taken when they overlap existing booking of another event type', async () => {
    // given: бронирование 10:00–11:00 типа «60 минут», слоты типа «30 минут»
    const store = storeWithEventType(30);
    store.addBooking({
      id: '0b8c3c52-6a43-4c1e-a8f4-1f0f8c9b2d71',
      eventType: { id: 'call-60', title: 'Созвон на час', durationMinutes: 60 },
      start: new Date('2026-11-25T10:00:00+05:00'),
      end: new Date('2026-11-25T11:00:00+05:00'),
      guestName: 'Иван Петров',
      guestEmail: 'ivan@example.com',
      createdAt: new Date('2026-11-24T09:00:00+05:00'),
    });
    const app = buildTestApp({ store });

    // when
    const response = await app.inject({ method: 'GET', url: '/api/event-types/call/slots' });

    // then
    expect(response.statusCode).toBe(200);
    const slots = expectResponseToMatchContract(response, 'EventTypes_listSlots') as SlotBody[];
    const around = slots.filter(
      (slot) =>
        slot.start >= '2026-11-25T09:30:00+05:00' && slot.start <= '2026-11-25T11:00:00+05:00',
    );
    expect(around).toEqual([
      { start: '2026-11-25T09:30:00+05:00', end: '2026-11-25T10:00:00+05:00', available: true },
      { start: '2026-11-25T09:45:00+05:00', end: '2026-11-25T10:15:00+05:00', available: false },
      { start: '2026-11-25T10:00:00+05:00', end: '2026-11-25T10:30:00+05:00', available: false },
      { start: '2026-11-25T10:15:00+05:00', end: '2026-11-25T10:45:00+05:00', available: false },
      { start: '2026-11-25T10:30:00+05:00', end: '2026-11-25T11:00:00+05:00', available: false },
      { start: '2026-11-25T10:45:00+05:00', end: '2026-11-25T11:15:00+05:00', available: false },
      { start: '2026-11-25T11:00:00+05:00', end: '2026-11-25T11:30:00+05:00', available: true },
    ]);
  });

  it('should respond 404 EVENT_TYPE_NOT_FOUND when event type does not exist', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({
      method: 'GET',
      url: '/api/event-types/unknown-type/slots',
    });

    // then
    expect(response.statusCode).toBe(404);
    expect(expectResponseToMatchContract(response, 'EventTypes_listSlots')).toEqual({
      code: 'EVENT_TYPE_NOT_FOUND',
      message: 'Тип встречи не найден',
    });
  });
});
