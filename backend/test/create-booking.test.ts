import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { createStore } from '../src/store.ts';
import { expectResponseToMatchContract } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

// Сейчас (FIXED_NOW) вторник, 24 ноября 2026, 10:00 по Алматы; бронируем на завтра, 25 ноября
const CALL_60 = { id: 'call-60', title: 'Встреча на час', description: '', durationMinutes: 60 };
const CALL_30 = { id: 'call-30', title: 'Встреча 30 минут', description: '', durationMinutes: 30 };

const GUEST = { guestName: 'Иван Петров', guestEmail: 'ivan@example.com' };

const SLOT_TAKEN = { code: 'SLOT_TAKEN', message: 'Это время уже заняли. Выберите другой слот' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function buildAppWithEventTypes(): FastifyInstance {
  const store = createStore();
  store.addEventType(CALL_60);
  store.addEventType(CALL_30);
  return buildTestApp({ store });
}

function book(app: FastifyInstance, payload: object): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url: '/api/bookings', payload });
}

/** Существующее бронирование 10:00–11:00 типа «Встреча на час» */
async function bookTenToEleven(app: FastifyInstance): Promise<void> {
  const response = await book(app, {
    eventTypeId: 'call-60',
    start: '2026-11-25T10:00:00+05:00',
    ...GUEST,
  });
  expect(response.statusCode).toBe(201);
}

describe('POST /api/bookings', () => {
  it('should respond 201 with booking and server-computed end when slot is free', async () => {
    // given
    const app = buildAppWithEventTypes();

    // when
    const response = await book(app, {
      eventTypeId: 'call-60',
      start: '2026-11-25T10:00:00+05:00',
      guestName: 'Иван Петров',
      guestEmail: 'ivan@example.com',
      note: 'Обсудить проект',
    });

    // then
    expect(response.statusCode).toBe(201);
    const booking = expectResponseToMatchContract(response, 'Bookings_create') as { id: string };
    expect(booking.id).toMatch(UUID_PATTERN);
    expect(booking).toEqual({
      id: booking.id,
      eventType: { id: 'call-60', title: 'Встреча на час', durationMinutes: 60 },
      start: '2026-11-25T10:00:00+05:00',
      end: '2026-11-25T11:00:00+05:00',
      guestName: 'Иван Петров',
      guestEmail: 'ivan@example.com',
      note: 'Обсудить проект',
      createdAt: '2026-11-24T10:00:00+05:00',
    });
  });

  it('should show booked slot as taken for every event type when booking is created', async () => {
    // given
    const app = buildAppWithEventTypes();

    // when
    await bookTenToEleven(app);

    // then
    const response = await app.inject({ method: 'GET', url: '/api/event-types/call-30/slots' });
    const slots = expectResponseToMatchContract(response, 'EventTypes_listSlots') as {
      start: string;
      available: boolean;
    }[];
    const around = slots
      .filter((s) => s.start >= '2026-11-25T09:30' && s.start <= '2026-11-25T11:00:00+05:00')
      .map((s) => `${s.start.slice(11, 16)} ${s.available ? 'свободно' : 'занято'}`);
    expect(around).toEqual([
      '09:30 свободно',
      '09:45 занято',
      '10:00 занято',
      '10:15 занято',
      '10:30 занято',
      '10:45 занято',
      '11:00 свободно',
    ]);
  });

  it('should return start in owner time zone when it is sent in UTC or another offset', async () => {
    // given
    const app = buildAppWithEventTypes();

    // when
    const inUtc = await book(app, {
      eventTypeId: 'call-30',
      start: '2026-11-25T05:00:00Z',
      ...GUEST,
    });
    const inMoscow = await book(app, {
      eventTypeId: 'call-30',
      start: '2026-11-25T10:00+03:00',
      ...GUEST,
    });

    // then
    expect(inUtc.statusCode).toBe(201);
    expect(expectResponseToMatchContract(inUtc, 'Bookings_create')).toMatchObject({
      start: '2026-11-25T10:00:00+05:00',
      end: '2026-11-25T10:30:00+05:00',
    });
    expect(inMoscow.statusCode).toBe(201);
    expect(expectResponseToMatchContract(inMoscow, 'Bookings_create')).toMatchObject({
      start: '2026-11-25T12:00:00+05:00',
      end: '2026-11-25T12:30:00+05:00',
    });
  });

  it('should trim strings, keep email as entered and omit blank note when fields have padding', async () => {
    // given
    const app = buildAppWithEventTypes();

    // when
    const response = await book(app, {
      eventTypeId: ' call-30 ',
      start: ' 2026-11-25T10:00:00+05:00 ',
      guestName: '  Иван Петров  ',
      guestEmail: '  Ivan.Petrov@Example.COM ',
      note: '   ',
    });

    // then
    expect(response.statusCode).toBe(201);
    const booking = expectResponseToMatchContract(response, 'Bookings_create');
    expect(booking).toMatchObject({
      eventType: { id: 'call-30' },
      start: '2026-11-25T10:00:00+05:00',
      guestName: 'Иван Петров',
      guestEmail: 'Ivan.Petrov@Example.COM',
    });
    expect(booking).not.toHaveProperty('note');
  });

  describe('when booking 10:00–11:00 already exists', () => {
    it('should respond 409 SLOT_TAKEN when 10:30–11:00 of 30 minute type overlaps 60 minute booking partially', async () => {
      // given: тип на 60 минут занят в 10:00, тип на 30 минут просит 10:30
      const app = buildAppWithEventTypes();
      await bookTenToEleven(app);

      // when
      const response = await book(app, {
        eventTypeId: 'call-30',
        start: '2026-11-25T10:30:00+05:00',
        ...GUEST,
      });

      // then
      expect(response.statusCode).toBe(409);
      expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual(SLOT_TAKEN);
    });

    it('should respond 409 SLOT_TAKEN when 09:45–10:15 of 30 minute type overlaps 60 minute booking beginning', async () => {
      // given: тип на 60 минут занят в 10:00, тип на 30 минут просит 09:45
      const app = buildAppWithEventTypes();
      await bookTenToEleven(app);

      // when
      const response = await book(app, {
        eventTypeId: 'call-30',
        start: '2026-11-25T09:45:00+05:00',
        ...GUEST,
      });

      // then
      expect(response.statusCode).toBe(409);
      expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual(SLOT_TAKEN);
    });

    it('should respond 409 SLOT_TAKEN when 09:30–10:30 overlaps its beginning', async () => {
      // given
      const app = buildAppWithEventTypes();
      await bookTenToEleven(app);

      // when
      const response = await book(app, {
        eventTypeId: 'call-60',
        start: '2026-11-25T09:30:00+05:00',
        ...GUEST,
      });

      // then
      expect(response.statusCode).toBe(409);
      expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual(SLOT_TAKEN);
    });

    it('should respond 409 SLOT_TAKEN when the same booking is sent again', async () => {
      // given
      const app = buildAppWithEventTypes();
      await bookTenToEleven(app);

      // when
      const response = await book(app, {
        eventTypeId: 'call-60',
        start: '2026-11-25T10:00:00+05:00',
        ...GUEST,
      });

      // then
      expect(response.statusCode).toBe(409);
      expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual(SLOT_TAKEN);
    });

    it('should respond 201 when 11:00–11:30 starts exactly at its end', async () => {
      // given
      const app = buildAppWithEventTypes();
      await bookTenToEleven(app);

      // when
      const response = await book(app, {
        eventTypeId: 'call-30',
        start: '2026-11-25T11:00:00+05:00',
        ...GUEST,
      });

      // then
      expect(response.statusCode).toBe(201);
      expect(expectResponseToMatchContract(response, 'Bookings_create')).toMatchObject({
        start: '2026-11-25T11:00:00+05:00',
        end: '2026-11-25T11:30:00+05:00',
      });
    });

    it('should respond 201 when 09:30–10:00 ends exactly at its start', async () => {
      // given
      const app = buildAppWithEventTypes();
      await bookTenToEleven(app);

      // when
      const response = await book(app, {
        eventTypeId: 'call-30',
        start: '2026-11-25T09:30:00+05:00',
        ...GUEST,
      });

      // then
      expect(response.statusCode).toBe(201);
    });
  });

  it('should create exactly one booking when two requests for the same time arrive at once', async () => {
    // given
    const app = buildAppWithEventTypes();
    const payload = { eventTypeId: 'call-30', start: '2026-11-25T10:00:00+05:00', ...GUEST };

    // when
    const responses = await Promise.all([book(app, payload), book(app, payload)]);

    // then
    expect(responses.map((response) => response.statusCode).toSorted()).toEqual([201, 409]);
    const conflict = responses.find((response) => response.statusCode === 409);
    expect(expectResponseToMatchContract(conflict!, 'Bookings_create')).toEqual(SLOT_TAKEN);
  });

  it.each([
    {
      reason: 'start is now',
      start: '2026-11-24T10:00:00+05:00',
      message: 'Это время уже прошло. Выберите другой слот',
    },
    {
      reason: 'slot started earlier today',
      start: '2026-11-24T09:00:00+05:00',
      message: 'Это время уже прошло. Выберите другой слот',
    },
    {
      reason: 'start is after the last day of booking window',
      start: '2026-12-08T10:00:00+05:00',
      message:
        'Это время вне окна записи: бронировать можно на 14 дней вперёд. Выберите другой слот',
    },
    {
      reason: 'start is not on 15 minute grid',
      start: '2026-11-25T10:10:00+05:00',
      message: 'Встреча начинается только в начале слота, каждые 15 минут. Выберите другой слот',
    },
    {
      reason: 'start is before working hours',
      start: '2026-11-25T08:45:00+05:00',
      message: 'Это время вне рабочих часов 09:00–18:00. Выберите другой слот',
    },
    {
      reason: 'meeting would end after working hours',
      start: '2026-11-25T17:45:00+05:00',
      message: 'Это время вне рабочих часов 09:00–18:00. Выберите другой слот',
    },
  ])('should respond 422 SLOT_NOT_OFFERED when $reason', async ({ start, message }) => {
    // given
    const app = buildAppWithEventTypes();

    // when
    const response = await book(app, { eventTypeId: 'call-30', start, ...GUEST });

    // then
    expect(response.statusCode).toBe(422);
    expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual({
      code: 'SLOT_NOT_OFFERED',
      message,
    });
  });

  it('should respond 404 EVENT_TYPE_NOT_FOUND before checking slot when event type does not exist', async () => {
    // given
    const app = buildAppWithEventTypes();

    // when
    const response = await book(app, {
      eventTypeId: 'unknown-type',
      start: '2026-11-25T10:10:00+05:00',
      ...GUEST,
    });

    // then
    expect(response.statusCode).toBe(404);
    expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual({
      code: 'EVENT_TYPE_NOT_FOUND',
      message: 'Тип встречи не найден',
    });
  });

  it('should respond 422 listing every field before looking up event type when all fields are missing', async () => {
    // given
    const app = buildAppWithEventTypes();

    // when
    const response = await book(app, {});

    // then
    expect(response.statusCode).toBe(422);
    expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Поля заполнены неверно',
      fields: [
        { field: 'eventTypeId', message: 'Обязательное поле' },
        { field: 'start', message: 'Обязательное поле' },
        { field: 'guestName', message: 'Обязательное поле' },
        { field: 'guestEmail', message: 'Обязательное поле' },
      ],
    });
  });

  it.each([
    {
      field: 'start',
      value: '2026-11-25T10:00:00',
      message: 'Время в формате ISO 8601 со смещением, например 2026-11-25T10:00:00+05:00',
    },
    {
      field: 'start',
      value: '25.11.2026 10:00',
      message: 'Время в формате ISO 8601 со смещением, например 2026-11-25T10:00:00+05:00',
    },
    {
      field: 'start',
      value: '2026-11-31T10:00:00+05:00',
      message: 'Время в формате ISO 8601 со смещением, например 2026-11-25T10:00:00+05:00',
    },
    { field: 'start', value: '   ', message: 'Обязательное поле' },
    { field: 'start', value: 1764046800000, message: 'Должно быть строкой' },
    { field: 'guestName', value: '   ', message: 'Обязательное поле' },
    { field: 'guestName', value: 'и'.repeat(101), message: 'Не длиннее 100 символов' },
    { field: 'guestEmail', value: 'ivan.example.com', message: 'Неверный формат email' },
    { field: 'guestEmail', value: 'ivan@example', message: 'Неверный формат email' },
    { field: 'guestEmail', value: 'ivan petrov@example.com', message: 'Неверный формат email' },
    {
      field: 'guestEmail',
      value: `${'a'.repeat(243)}@example.com`,
      message: 'Не длиннее 254 символов',
    },
    { field: 'note', value: 'з'.repeat(1001), message: 'Не длиннее 1000 символов' },
    { field: 'note', value: 42, message: 'Должно быть строкой' },
  ])('should respond 422 for $field when $field is $value', async ({ field, value, message }) => {
    // given
    const app = buildAppWithEventTypes();

    // when
    const response = await book(app, {
      eventTypeId: 'call-30',
      start: '2026-11-25T10:00:00+05:00',
      ...GUEST,
      [field]: value,
    });

    // then
    expect(response.statusCode).toBe(422);
    expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Поля заполнены неверно',
      fields: [{ field, message }],
    });
  });

  it('should accept boundary lengths when name, email and note are at their limits', async () => {
    // given
    const app = buildAppWithEventTypes();
    const guestEmail = `${'a'.repeat(242)}@example.com`;

    // when
    const response = await book(app, {
      eventTypeId: 'call-30',
      start: '2026-11-25T10:00:00+05:00',
      guestName: 'и'.repeat(100),
      guestEmail,
      note: 'з'.repeat(1000),
    });

    // then
    expect(response.statusCode).toBe(201);
    expect(expectResponseToMatchContract(response, 'Bookings_create')).toMatchObject({
      guestName: 'и'.repeat(100),
      guestEmail,
      note: 'з'.repeat(1000),
    });
  });

  it.each([
    { reason: 'json is broken', contentType: 'application/json', payload: '{"start": ' },
    { reason: 'json is an array', contentType: 'application/json', payload: '[]' },
    { reason: 'body is plain text', contentType: 'text/plain', payload: 'book me' },
  ])('should respond 400 MALFORMED_REQUEST when $reason', async ({ contentType, payload }) => {
    // given
    const app = buildAppWithEventTypes();

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      headers: { 'content-type': contentType },
      payload,
    });

    // then
    expect(response.statusCode).toBe(400);
    expect(expectResponseToMatchContract(response, 'Bookings_create')).toEqual({
      code: 'MALFORMED_REQUEST',
      message: 'Тело запроса должно быть JSON-объектом',
    });
  });
});
