import { describe, expect, it } from 'vitest';
import { computeSlots, type Slot } from '../src/slots.ts';
import type { StoredBooking } from '../src/store.ts';

/** Момент по Алматы: `at('2026-11-24T10:00')` — 24 ноября 2026, 10:00 UTC+5 */
function at(localDateTime: string): Date {
  return new Date(`${localDateTime}:00+05:00`);
}

/** Слоты одного дня по Алматы в виде `09:00–10:00` для наглядного сравнения */
function slotsOfDay(slots: Slot[], day: string): string[] {
  return slots
    .filter((slot) => slot.start >= at(`${day}T00:00`) && slot.start < at(`${day}T23:59`))
    .map((slot) => `${hhmm(slot.start)}–${hhmm(slot.end)}`);
}

function hhmm(date: Date): string {
  // Сдвиг на +5 часов и чтение UTC-полей дают время по Алматы независимо от пояса машины
  return new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

const MEETING_60 = { durationMinutes: 60 };

describe('Расчёт слотов', () => {
  it('should offer slots every 15 minutes from 09:00 when day is fully in the future', () => {
    // given
    const now = at('2026-11-24T10:00');

    // when
    const slots = computeSlots(MEETING_60, [], now);

    // then
    expect(slotsOfDay(slots, '2026-11-25').slice(0, 3)).toEqual([
      '09:00–10:00',
      '09:15–10:15',
      '09:30–10:30',
    ]);
  });

  it('should end day with slot that finishes exactly at 18:00 when duration does not fit later', () => {
    // given
    const now = at('2026-11-24T10:00');

    // when
    const slots = computeSlots(MEETING_60, [], now);

    // then
    expect(slotsOfDay(slots, '2026-11-25').slice(-2)).toEqual(['16:45–17:45', '17:00–18:00']);
  });

  it('should list started slots as unavailable and slot starting exactly now as unavailable when now is on the grid', () => {
    // given
    const now = at('2026-11-24T10:00');

    // when
    const slots = computeSlots({ durationMinutes: 15 }, [], now);

    // then: день окна начинается с 09:00; слот, начавшийся ровно «сейчас», уже не доступен
    const morning = slots
      .filter(
        (slot) => slot.start >= at('2026-11-24T09:30') && slot.start <= at('2026-11-24T10:15'),
      )
      .map((slot) => [hhmm(slot.start), slot.available]);
    expect(morning).toEqual([
      ['09:30', false],
      ['09:45', false],
      ['10:00', false],
      ['10:15', true],
    ]);
    expect(slots[0]).toEqual({
      start: at('2026-11-24T09:00'),
      end: at('2026-11-24T09:15'),
      available: false,
    });
  });

  it('should offer 14 days with last day 13 days after today when window is computed', () => {
    // given
    const now = at('2026-11-24T10:00');

    // when
    const slots = computeSlots({ durationMinutes: 15 }, [], now);

    // then
    expect(slots.at(-1)).toEqual({
      start: at('2026-12-07T17:45'),
      end: at('2026-12-07T18:00'),
      available: true,
    });
    expect(slotsOfDay(slots, '2026-12-08')).toEqual([]);
  });

  it('should start window on Almaty date when it is already past midnight in Almaty but not in UTC', () => {
    // given: 25 ноября 00:30 по Алматы — это ещё 24 ноября 19:30 по UTC
    const now = at('2026-11-25T00:30');

    // when
    const slots = computeSlots(MEETING_60, [], now);

    // then
    expect(slots[0]?.start).toEqual(at('2026-11-25T09:00'));
    expect(slots.at(-1)?.start).toEqual(at('2026-12-08T17:00'));
    expect(slotsOfDay(slots, '2026-11-24')).toEqual([]);
  });

  it('should keep adjacent slots free and mark partially overlapping ones taken when booking is of another type', () => {
    // given: бронирование 10:00–11:00 типа «60 минут», слоты считаются для типа «30 минут»
    const booking: StoredBooking = {
      id: '7d0f3f4e-1b7c-4d2a-9a51-5d6c2b4e8f10',
      eventType: { id: 'call-60', title: 'Созвон на час', durationMinutes: 60 },
      start: at('2026-11-25T10:00'),
      end: at('2026-11-25T11:00'),
      guestName: 'Иван Петров',
      guestEmail: 'ivan@example.com',
      createdAt: at('2026-11-24T09:00'),
    };
    const now = at('2026-11-24T10:00');

    // when
    const slots = computeSlots({ durationMinutes: 30 }, [booking], now);

    // then
    const around = slots
      .filter(
        (slot) => slot.start >= at('2026-11-25T09:30') && slot.start <= at('2026-11-25T11:00'),
      )
      .map((slot) => [`${hhmm(slot.start)}–${hhmm(slot.end)}`, slot.available]);
    expect(around).toEqual([
      ['09:30–10:00', true],
      ['09:45–10:15', false],
      ['10:00–10:30', false],
      ['10:15–10:45', false],
      ['10:30–11:00', false],
      ['10:45–11:15', false],
      ['11:00–11:30', true],
    ]);
  });
});
