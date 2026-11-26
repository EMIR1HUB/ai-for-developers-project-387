import type { EventType } from './generated/types.gen.ts';

/**
 * Бронирование в хранилище. Моменты времени хранятся как `Date`, в строку со смещением
 * владельца они переводятся на границе API (`formatOwnerTime`).
 */
export interface StoredBooking {
  id: string;
  /** Сводка типа встречи на момент бронирования */
  eventType: Pick<EventType, 'id' | 'title' | 'durationMinutes'>;
  start: Date;
  /** Начало плюс длительность типа встречи, интервал `[start, end)` */
  end: Date;
  guestName: string;
  guestEmail: string;
  note?: string;
  createdAt: Date;
}

/**
 * Хранилище в памяти одного процесса (ADR-0002). Методы синхронные: проверка и запись
 * выполняются без `await` между ними, поэтому одновременные запросы не могут оба пройти.
 */
export interface Store {
  /** Типы встреч в порядке создания */
  listEventTypes(): EventType[];
  findEventType(id: string): EventType | undefined;
  addEventType(eventType: EventType): void;
  /** Все бронирования всех типов встреч в порядке создания */
  listBookings(): StoredBooking[];
  /**
   * Предстоящие бронирования всех типов встреч по возрастанию начала: те, что ещё не закончились
   * к моменту `now` (`end > now`), в том числе идущее прямо сейчас
   */
  listUpcomingBookings(now: Date): StoredBooking[];
  addBooking(booking: StoredBooking): void;
}

export function createStore(): Store {
  // Map сохраняет порядок вставки, он же порядок создания
  const eventTypes = new Map<string, EventType>();
  const bookings: StoredBooking[] = [];

  return {
    listEventTypes: () => [...eventTypes.values()],
    findEventType: (id) => eventTypes.get(id),
    addEventType: (eventType) => {
      eventTypes.set(eventType.id, eventType);
    },
    listBookings: () => [...bookings],
    listUpcomingBookings: (now) =>
      bookings
        .filter((booking) => booking.end > now)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    addBooking: (booking) => {
      bookings.push(booking);
    },
  };
}
