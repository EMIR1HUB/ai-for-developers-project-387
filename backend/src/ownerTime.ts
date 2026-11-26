/**
 * Время в часовом поясе владельца (`Asia/Almaty`, см. `ownerProfile.ts`).
 * В Казахстане нет летнего времени, с 1 марта 2024 года Алматы постоянно в UTC+5,
 * поэтому смещение одно на все даты и считается без таблиц часовых поясов.
 */
export const OWNER_UTC_OFFSET = '+05:00';

export const MINUTE_MS = 60 * 1000;
const OWNER_OFFSET_MS = 5 * 60 * MINUTE_MS;

/** Календарная дата по поясу владельца, месяц с нуля, как в `Date.UTC` */
export interface OwnerDate {
  year: number;
  month: number;
  day: number;
}

/** Дата по поясу владельца, на которую приходится момент */
export function ownerDateOf(moment: Date): OwnerDate {
  const shifted = new Date(moment.getTime() + OWNER_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/**
 * Момент, когда по поясу владельца наступает `minutes` минут от начала даты.
 * `day` может выходить за длину месяца: `Date.UTC` переносит его на следующий месяц.
 */
export function ownerMoment({ year, month, day }: OwnerDate, minutes: number): Date {
  return new Date(Date.UTC(year, month, day) - OWNER_OFFSET_MS + minutes * MINUTE_MS);
}

/** ISO 8601 со смещением владельца: `2026-11-24T09:00:00+05:00` */
export function formatOwnerTime(moment: Date): string {
  const shifted = new Date(moment.getTime() + OWNER_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}${OWNER_UTC_OFFSET}`;
}

/** `start` и `end` интервала в формате API, остальные поля (`available` и т. п.) не копируются */
export function formatOwnerInterval(interval: { start: Date; end: Date }): {
  start: string;
  end: string;
} {
  return { start: formatOwnerTime(interval.start), end: formatOwnerTime(interval.end) };
}
