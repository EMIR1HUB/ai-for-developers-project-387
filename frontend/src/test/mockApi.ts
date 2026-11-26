import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import type {
  BookingsCreateData,
  BookingsCreateErrors,
  BookingsCreateResponses,
  BookingsListData,
  BookingsListErrors,
  BookingsListResponses,
  EventTypesCreateData,
  EventTypesCreateErrors,
  EventTypesCreateResponses,
  EventTypesGetData,
  EventTypesGetErrors,
  EventTypesGetResponses,
  EventTypesListData,
  EventTypesListErrors,
  EventTypesListResponses,
  EventTypesListSlotsData,
  EventTypesListSlotsErrors,
  EventTypesListSlotsResponses,
  OwnerGetData,
  OwnerGetErrors,
  OwnerGetResponses,
} from '../api/generated/types.gen';

/**
 * Операции контракта, которые подменяют тесты. Типы берутся из сгенерированного SDK, поэтому
 * обработчик с неверным адресом, статусом или телом не пройдёт проверку типов.
 * Новая операция добавляется сюда и в `OPERATIONS`.
 */
interface ApiOperations {
  eventTypesList: {
    data: EventTypesListData;
    responses: EventTypesListResponses;
    errors: EventTypesListErrors;
  };
  eventTypesCreate: {
    data: EventTypesCreateData;
    responses: EventTypesCreateResponses;
    errors: EventTypesCreateErrors;
  };
  eventTypesGet: {
    data: EventTypesGetData;
    responses: EventTypesGetResponses;
    errors: EventTypesGetErrors;
  };
  eventTypesListSlots: {
    data: EventTypesListSlotsData;
    responses: EventTypesListSlotsResponses;
    errors: EventTypesListSlotsErrors;
  };
  ownerGet: {
    data: OwnerGetData;
    responses: OwnerGetResponses;
    errors: OwnerGetErrors;
  };
  bookingsCreate: {
    data: BookingsCreateData;
    responses: BookingsCreateResponses;
    errors: BookingsCreateErrors;
  };
  bookingsList: {
    data: BookingsListData;
    responses: BookingsListResponses;
    errors: BookingsListErrors;
  };
}

type OperationName = keyof ApiOperations;
type Method = 'get' | 'post';
type StatusMap<Name extends OperationName> = ApiOperations[Name]['responses'] &
  ApiOperations[Name]['errors'];
type RequestBody<Name extends OperationName> = ApiOperations[Name]['data']['body'];

const OPERATIONS: {
  [Name in OperationName]: { method: Method; url: ApiOperations[Name]['data']['url'] };
} = {
  eventTypesList: { method: 'get', url: '/api/event-types' },
  eventTypesCreate: { method: 'post', url: '/api/event-types' },
  eventTypesGet: { method: 'get', url: '/api/event-types/{id}' },
  eventTypesListSlots: { method: 'get', url: '/api/event-types/{id}/slots' },
  ownerGet: { method: 'get', url: '/api/owner' },
  bookingsCreate: { method: 'post', url: '/api/bookings' },
  bookingsList: { method: 'get', url: '/api/bookings' },
};

// Hey API пишет параметры пути как `{id}`, MSW ждёт `:id`
function toMswPath(url: string): string {
  return url.replace(/\{(\w+)\}/g, ':$1');
}

/**
 * Обработчик MSW, который отвечает на операцию контракта заданным статусом и телом.
 * `onRequest` получает JSON-тело запроса, чтобы тест проверил, что отправила страница.
 */
export function mockApi<Name extends OperationName, Status extends keyof StatusMap<Name> & number>(
  name: Name,
  status: Status,
  body: StatusMap<Name>[Status],
  onRequest?: (requestBody: RequestBody<Name>) => void,
): HttpHandler {
  const { method, url } = OPERATIONS[name];
  return http[method](toMswPath(url), async ({ request }) => {
    if (onRequest) {
      onRequest((await request.json()) as RequestBody<Name>);
    }
    return HttpResponse.json(body as object, { status });
  });
}

/** Обработчик MSW, имитирующий сетевую ошибку (сервер недоступен) */
export function mockApiNetworkError(name: OperationName): HttpHandler {
  const { method, url } = OPERATIONS[name];
  return http[method](toMswPath(url), () => HttpResponse.error());
}

/**
 * Сеть по умолчанию: пустые ответы, чтобы страницы рендерились в любом тесте.
 * Тест переопределяет нужную операцию через `server.use(mockApi(...))`.
 */
export const server = setupServer(
  mockApi('eventTypesList', 200, []),
  mockApi('ownerGet', 200, { name: 'Владелец', subtitle: '', timeZone: 'Asia/Almaty' }),
  mockApi('bookingsList', 200, []),
);
