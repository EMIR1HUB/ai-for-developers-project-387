import type { Slot } from '../../api/generated/types.gen';
import { ownerDate } from '../../ownerTime.ts';

/** Слоты окна записи по дням `YYYY-MM-DD` в порядке, в котором их отдал сервер */
export type SlotDays = Map<string, Slot[]>;

export function groupSlotsByDay(slots: readonly Slot[]): SlotDays {
  const days: SlotDays = new Map();
  for (const slot of slots) {
    const day = ownerDate(slot.start);
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return days;
}

export function freeSlotCount(slots: readonly Slot[]): number {
  return slots.filter((slot) => slot.available).length;
}

/** День, выбранный по умолчанию: первый со свободными слотами, иначе первый день окна */
export function defaultDay(days: SlotDays): string | null {
  for (const [day, slots] of days) {
    if (freeSlotCount(slots) > 0) {
      return day;
    }
  }
  return days.keys().next().value ?? null;
}
