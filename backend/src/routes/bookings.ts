import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppContext } from '../app.ts';
import { EVENT_TYPE_NOT_FOUND_MESSAGE, sendError } from '../errors.ts';
import type {
  Booking,
  BookingsCreateResponse,
  BookingsListResponse,
} from '../generated/types.gen.ts';
import { formatOwnerInterval, formatOwnerTime } from '../ownerTime.ts';
import {
  BOOKING_WINDOW_DAYS,
  findOfferedSlot,
  intervalsOverlap,
  SLOT_STEP_MINUTES,
  WORKING_DAY_END_MINUTES,
  WORKING_DAY_START_MINUTES,
  type SlotRejection,
} from '../slots.ts';
import type { StoredBooking } from '../store.ts';
import { parseBody, type FieldReader } from '../validation.ts';

const SLOT_TAKEN_MESSAGE = 'Это время уже заняли. Выберите другой слот';

/** Минуты от начала дня в виде `09:00` */
function clock(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

const SLOT_NOT_OFFERED_MESSAGES: Record<SlotRejection, string> = {
  started: 'Это время уже прошло. Выберите другой слот',
  outsideWindow: `Это время вне окна записи: бронировать можно на ${BOOKING_WINDOW_DAYS} дней вперёд. Выберите другой слот`,
  offGrid: `Встреча начинается только в начале слота, каждые ${SLOT_STEP_MINUTES} минут. Выберите другой слот`,
  outsideWorkingHours: `Это время вне рабочих часов ${clock(WORKING_DAY_START_MINUTES)}–${clock(WORKING_DAY_END_MINUTES)}. Выберите другой слот`,
};

function readNewBooking(fields: FieldReader) {
  return {
    eventTypeId: fields.string('eventTypeId', { minLength: 1, maxLength: 50 }),
    start: fields.offsetDateTime('start'),
    guestName: fields.string('guestName', { minLength: 1, maxLength: 100 }),
    guestEmail: fields.email('guestEmail'),
    note: fields.optionalString('note', { maxLength: 1000 }),
  };
}

export function toBookingResponse(booking: StoredBooking): Booking {
  return {
    id: booking.id,
    eventType: booking.eventType,
    ...formatOwnerInterval(booking),
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    ...(booking.note === undefined ? {} : { note: booking.note }),
    createdAt: formatOwnerTime(booking.createdAt),
  };
}

export function registerBookingRoutes(app: FastifyInstance, { store, now }: AppContext): void {
  app.get('/api/bookings', async (): Promise<BookingsListResponse> =>
    store.listUpcomingBookings(now()).map(toBookingResponse),
  );

  app.post(
    '/api/bookings',
    async (request, reply): Promise<BookingsCreateResponse | FastifyReply> => {
      // Порядок проверок — спецификация EMIR1HUB/ai-for-developers-project-386#11, «Создание бронирования: порядок проверок».
      // От поиска слота до записи нет ни одного await (ADR-0002): Node выполняет этот участок
      // целиком, поэтому из двух одновременных запросов на одно время проходит ровно один
      const { eventTypeId, start, guestName, guestEmail, note } = parseBody(
        request.body,
        readNewBooking,
      );
      const eventType = store.findEventType(eventTypeId);
      if (!eventType) {
        return sendError(reply, 'EVENT_TYPE_NOT_FOUND', EVENT_TYPE_NOT_FOUND_MESSAGE);
      }

      const createdAt = now();
      const offered = findOfferedSlot(eventType, start, createdAt);
      if ('rejection' in offered) {
        return sendError(reply, 'SLOT_NOT_OFFERED', SLOT_NOT_OFFERED_MESSAGES[offered.rejection]);
      }
      // Пересечение с бронированием любого типа встречи, не только этого
      if (store.listBookings().some((booking) => intervalsOverlap(offered.slot, booking))) {
        return sendError(reply, 'SLOT_TAKEN', SLOT_TAKEN_MESSAGE);
      }

      const booking: StoredBooking = {
        id: randomUUID(),
        eventType: {
          id: eventType.id,
          title: eventType.title,
          durationMinutes: eventType.durationMinutes,
        },
        ...offered.slot,
        guestName,
        guestEmail,
        ...(note === undefined ? {} : { note }),
        createdAt,
      };
      store.addBooking(booking);
      reply.status(201);
      return toBookingResponse(booking);
    },
  );
}
