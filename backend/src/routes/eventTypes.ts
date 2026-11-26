import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppContext } from '../app.ts';
import { EVENT_TYPE_NOT_FOUND_MESSAGE, sendError } from '../errors.ts';
import type {
  EventType,
  EventTypesCreateResponse,
  EventTypesGetData,
  EventTypesGetResponse,
  EventTypesListResponse,
  EventTypesListSlotsData,
  EventTypesListSlotsResponse,
} from '../generated/types.gen.ts';
import { formatOwnerInterval } from '../ownerTime.ts';
import { computeSlots } from '../slots.ts';
import { parseBody, type FieldReader } from '../validation.ts';

// Строчные латинские буквы и цифры, группы через одиночный дефис: дефис не в начале,
// не в конце и не подряд (спецификация EMIR1HUB/ai-for-developers-project-386#11, «Модели»)
const EVENT_TYPE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function readNewEventType(fields: FieldReader): EventType {
  return {
    id: fields.string('id', {
      minLength: 3,
      maxLength: 50,
      pattern: EVENT_TYPE_ID_PATTERN,
      patternMessage:
        'Только строчные латинские буквы, цифры и дефис; дефис не в начале, не в конце и не подряд',
    }),
    title: fields.string('title', { minLength: 1, maxLength: 100 }),
    description: fields.string('description', { maxLength: 500 }),
    durationMinutes: fields.integer('durationMinutes', {
      min: 15,
      max: 240,
      step: 15,
      message: 'От 15 до 240 минут с шагом 15',
    }),
  };
}

export function registerEventTypeRoutes(app: FastifyInstance, { store, now }: AppContext): void {
  app.get('/api/event-types', async (): Promise<EventTypesListResponse> => store.listEventTypes());

  app.post(
    '/api/event-types',
    async (request, reply): Promise<EventTypesCreateResponse | FastifyReply> => {
      const eventType = parseBody(request.body, readNewEventType);
      // Проверка и запись без await между ними (ADR-0002): два одновременных запроса с одним
      // идентификатором не создадут два типа встречи
      if (store.findEventType(eventType.id)) {
        return sendError(reply, 'EVENT_TYPE_ID_TAKEN', 'Идентификатор уже занят. Выберите другой');
      }
      store.addEventType(eventType);
      reply.status(201);
      return eventType;
    },
  );

  app.get<{ Params: EventTypesGetData['path'] }>(
    '/api/event-types/:id',
    async (request, reply): Promise<EventTypesGetResponse | FastifyReply> => {
      const eventType = store.findEventType(request.params.id);
      if (!eventType) {
        return sendError(reply, 'EVENT_TYPE_NOT_FOUND', EVENT_TYPE_NOT_FOUND_MESSAGE);
      }
      return eventType;
    },
  );

  app.get<{ Params: EventTypesListSlotsData['path'] }>(
    '/api/event-types/:id/slots',
    async (request, reply): Promise<EventTypesListSlotsResponse | FastifyReply> => {
      const eventType = store.findEventType(request.params.id);
      if (!eventType) {
        return sendError(reply, 'EVENT_TYPE_NOT_FOUND', EVENT_TYPE_NOT_FOUND_MESSAGE);
      }
      return computeSlots(eventType, store.listBookings(), now()).map((slot) => ({
        ...formatOwnerInterval(slot),
        available: slot.available,
      }));
    },
  );
}
