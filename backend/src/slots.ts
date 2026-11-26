import type { EventType } from './generated/types.gen.ts';
import { MINUTE_MS, ownerDateOf, ownerMoment } from './ownerTime.ts';

/** Окно записи: сегодня по поясу владельца и ещё 13 дней */
export const BOOKING_WINDOW_DAYS = 14;
/** Рабочие часы владельца 09:00–18:00 каждый день, в минутах от начала дня */
export const WORKING_DAY_START_MINUTES = 9 * 60;
export const WORKING_DAY_END_MINUTES = 18 * 60;
/** Шаг начала слотов одинаковый для всех типов встреч */
export const SLOT_STEP_MINUTES = 15;

/** Полуоткрытый интервал времени `[start, end)` */
export interface TimeInterval {
  start: Date;
  end: Date;
}

/** Слот окна записи. `available: false` — слот уже начался или пересекается с бронированием */
export interface Slot extends TimeInterval {
  available: boolean;
}

/**
 * Пересекаются ли интервалы `[start, end)`. Сравнение строгое: бронирование может начинаться
 * ровно в момент окончания другого, примыкание пересечением не считается.
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Все слоты окна записи для типа встречи. Слот целиком лежит в рабочих часах. Слот доступен,
 * только если его начало строго позже `now` и он не пересекается с бронированием любого типа
 * встречи; начавшиеся слоты остаются в списке с `available: false`.
 *
 * Эту же функцию использует проверка при создании бронирования (`findOfferedSlot`): сервер
 * принимает только начало слота из этого списка, которое ещё не наступило.
 */
export function computeSlots(
  eventType: Pick<EventType, 'durationMinutes'>,
  bookings: readonly TimeInterval[],
  now: Date,
): Slot[] {
  const today = ownerDateOf(now);
  const slots: Slot[] = [];

  for (let dayOffset = 0; dayOffset < BOOKING_WINDOW_DAYS; dayOffset++) {
    const day = { ...today, day: today.day + dayOffset };
    for (
      let startMinutes = WORKING_DAY_START_MINUTES;
      startMinutes + eventType.durationMinutes <= WORKING_DAY_END_MINUTES;
      startMinutes += SLOT_STEP_MINUTES
    ) {
      const start = ownerMoment(day, startMinutes);
      const slot = { start, end: ownerMoment(day, startMinutes + eventType.durationMinutes) };
      slots.push({
        ...slot,
        available: start > now && !bookings.some((booking) => intervalsOverlap(slot, booking)),
      });
    }
  }

  return slots;
}

/** Почему начало не совпадает ни с одним предлагаемым слотом */
export type SlotRejection = 'started' | 'outsideWindow' | 'offGrid' | 'outsideWorkingHours';

function rejectionOf(start: Date, now: Date): SlotRejection {
  if (start <= now) {
    return 'started';
  }
  const today = ownerDateOf(now);
  const windowEnd = ownerMoment({ ...today, day: today.day + BOOKING_WINDOW_DAYS }, 0);
  if (start >= windowEnd) {
    return 'outsideWindow';
  }
  const minutesOfDay = (start.getTime() - ownerMoment(ownerDateOf(start), 0).getTime()) / MINUTE_MS;
  if (minutesOfDay % SLOT_STEP_MINUTES !== 0) {
    return 'offGrid';
  }
  return 'outsideWorkingHours';
}

/**
 * Слот, который ручка слотов сейчас предлагает с этим началом, занятый или свободный, либо причина,
 * почему такого слота нет. Слот берётся из `computeSlots`, поэтому сервер принимает ровно
 * те начала, что показывает гостю; начавшийся слот не предлагается (`started`). Занятость
 * проверяет вызывающий код.
 */
export function findOfferedSlot(
  eventType: Pick<EventType, 'durationMinutes'>,
  start: Date,
  now: Date,
): { slot: TimeInterval } | { rejection: SlotRejection } {
  // Без бронирований `available` означает только «ещё не началось»: занятые слоты тоже предлагаются
  const slot = computeSlots(eventType, [], now).find(
    (candidate) => candidate.start.getTime() === start.getTime(),
  );
  return slot?.available
    ? { slot: { start: slot.start, end: slot.end } }
    : { rejection: rejectionOf(start, now) };
}
