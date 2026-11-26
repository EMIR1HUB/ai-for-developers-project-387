import "@typespec/http";

using Http;

@service(#{ title: "Calendar API" })
namespace CalendarApi;

model Health {
  status: "ok";
}

@route("/api/health")
@tag("Health")
interface HealthCheck {
  /** Проверка, что сервис запущен и отвечает */
  @get check(): Health;
}

/** Код ошибки: закрытое перечисление, клиент различает ошибки по нему */
enum ErrorCode {
  /** 422: поля запроса невалидны, все ошибочные поля перечислены в `fields` */
  VALIDATION_ERROR,

  /** 422: начало бронирования не совпадает с началом предлагаемого слота */
  SLOT_NOT_OFFERED,

  /** 404: тип встречи с таким идентификатором не найден */
  EVENT_TYPE_NOT_FOUND,

  /** 404: неизвестный адрес под `/api` */
  NOT_FOUND,

  /** 409: идентификатор типа встречи уже занят */
  EVENT_TYPE_ID_TAKEN,

  /** 409: время пересекается с существующим бронированием */
  SLOT_TAKEN,

  /** 400: тело запроса не читается как JSON */
  MALFORMED_REQUEST,

  /** 500: непредвиденная ошибка, подробности только в логе сервера */
  INTERNAL_ERROR,
}

/** Ошибка одного поля запроса */
model FieldError {
  /** Имя поля, вложенные поля через точку */
  field: string;

  /** Текст ошибки для пользователя */
  message: string;
}

/** Тело любой ошибки API */
@error
model ApiError {
  code: ErrorCode;

  /** Текст для пользователя на русском, фронтенд показывает его как есть */
  message: string;

  /** Все ошибочные поля, только для `422 VALIDATION_ERROR` */
  fields?: FieldError[];
}

/** Ответ с ошибкой: статус и общее тело ошибки */
@error
model ErrorResponse<Status extends int32> {
  @statusCode statusCode: Status;
  @body body: ApiError;
}

/** Непредвиденная ошибка сервера (`INTERNAL_ERROR`) */
alias InternalError = ErrorResponse<500>;

/** Тело запроса не читается как JSON-объект (`MALFORMED_REQUEST`) */
alias MalformedRequest = ErrorResponse<400>;

/** Поля запроса невалидны (`VALIDATION_ERROR`), все ошибочные поля перечислены в `fields` */
alias ValidationFailed = ErrorResponse<422>;

/** Ресурс создан */
model Created<T> {
  @statusCode statusCode: 201;
  @body body: T;
}

/** Профиль владельца, который видит гость. Задан в конфиге бэкенда */
model OwnerProfile {
  name: string;

  /** Подпись под именем, например род занятий */
  subtitle: string;

  /** Часовой пояс владельца в формате IANA, например `Asia/Almaty` */
  timeZone: string;
}

@route("/api/owner")
@tag("Owner")
interface Owner {
  /** Профиль владельца */
  @get get(): OwnerProfile | InternalError;
}

/** Шаблон встречи владельца. После создания не меняется и не удаляется */
model EventType {
  /** Идентификатор, который задаёт владелец: строчные латинские буквы, цифры и дефис (не в начале, не в конце и не подряд) */
  @minLength(3)
  @maxLength(50)
  @pattern("^[a-z0-9]+(-[a-z0-9]+)*$")
  id: string;

  @minLength(1)
  @maxLength(100)
  title: string;

  /** Может быть пустым */
  @maxLength(500)
  description: string;

  /** Длительность в минутах, кратна 15 */
  @minValue(15)
  @maxValue(240)
  durationMinutes: int32;
}

/** Тип встречи с таким идентификатором не найден (`EVENT_TYPE_NOT_FOUND`) */
alias EventTypeNotFound = ErrorResponse<404>;

/**
 * Интервал времени `[start, end)` длиной в длительность типа встречи внутри рабочих часов владельца.
 * Не хранится, сервер вычисляет его по текущему моменту и бронированиям
 */
model Slot {
  /** Начало со смещением пояса владельца, например `2026-11-24T09:00:00+05:00` */
  start: offsetDateTime;

  /** Конец: начало плюс длительность типа встречи */
  end: offsetDateTime;

  /** `false`, если слот уже начался или пересекается с бронированием любого типа встречи */
  available: boolean;
}

/**
 * Новый тип встречи. Сервер обрезает пробелы по краям строк и только потом проверяет поля
 * по правилам `EventType`, поэтому ограничения формата здесь не повторяются
 */
model NewEventType {
  /** Строчные латинские буквы, цифры и дефис (не в начале, не в конце и не подряд), 3–50 символов */
  id: string;

  /** 1–100 символов */
  title: string;

  /** До 500 символов, может быть пустым */
  description: string;

  /** 15–240, кратно 15 */
  durationMinutes: int32;
}

@route("/api/event-types")
@tag("EventTypes")
interface EventTypes {
  /** Типы встреч в порядке создания */
  @get list(): EventType[] | InternalError;

  /** Создание типа встречи владельцем. Занятый идентификатор — `409 EVENT_TYPE_ID_TAKEN` */
  @post create(@body eventType: NewEventType):
    | Created<EventType>
    | MalformedRequest
    | ErrorResponse<409>
    | ValidationFailed
    | InternalError;

  /** Тип встречи по идентификатору */
  @get
  @route("/{id}")
  get(@path id: string): EventType | EventTypeNotFound | InternalError;

  /**
   * Все слоты окна записи (сегодня по поясу владельца и ещё 13 дней) по возрастанию начала.
   * Слоты, которые уже начались, остаются в списке с `available: false`
   */
  @get
  @route("/{id}/slots")
  listSlots(@path id: string): Slot[] | EventTypeNotFound | InternalError;
}

/** Сводка типа встречи в бронировании */
model BookingEventType {
  id: string;
  title: string;
  durationMinutes: int32;
}

/** Интервал `[start, end)`, занятый гостем под тип встречи. После создания не меняется и не отменяется */
model Booking {
  /** UUID, который назначает сервер */
  @format("uuid")
  id: string;

  eventType: BookingEventType;

  /** Начало со смещением пояса владельца, например `2026-11-25T10:00:00+05:00` */
  start: offsetDateTime;

  /** Конец: начало плюс длительность типа встречи, считает сервер */
  end: offsetDateTime;

  @minLength(1)
  @maxLength(100)
  guestName: string;

  /** Как ввёл гость */
  @maxLength(254)
  guestEmail: string;

  /** Заметка гостя для владельца, нет, если гость её не оставил */
  @maxLength(1000)
  note?: string;

  /** Момент создания со смещением пояса владельца */
  createdAt: offsetDateTime;
}

/**
 * Новое бронирование. Сервер обрезает пробелы по краям строк и только потом проверяет поля
 * по правилам `Booking`, поэтому ограничения формата здесь не повторяются
 */
model NewBooking {
  /** Идентификатор типа встречи */
  eventTypeId: string;

  /**
   * Начало слота из `GET /api/event-types/{id}/slots`: ISO 8601 со смещением или `Z`,
   * время без смещения — `422 VALIDATION_ERROR`
   */
  start: string;

  /** 1–100 символов */
  guestName: string;

  /** Формат email, до 254 символов */
  guestEmail: string;

  /** До 1000 символов */
  note?: string;
}

@route("/api/bookings")
@tag("Bookings")
interface Bookings {
  /**
   * Предстоящие бронирования всех типов встреч по возрастанию начала: те, что ещё не закончились
   * (`end` позже текущего момента), в том числе идущее прямо сейчас
   */
  @get list(): Booking[] | InternalError;

  /**
   * Создание бронирования гостем; конец сервер считает по длительности типа встречи.
   * `422`: `VALIDATION_ERROR` — поля невалидны; `SLOT_NOT_OFFERED` — `start` не совпадает с началом
   * слота, который сейчас предлагает ручка слотов (причина в `message`).
   * `409 SLOT_TAKEN` — интервал пересекается с бронированием любого типа встречи
   */
  @post create(@body booking: NewBooking):
    | Created<Booking>
    | MalformedRequest
    | EventTypeNotFound
    | ErrorResponse<409>
    | ErrorResponse<422>
    | InternalError;
}
