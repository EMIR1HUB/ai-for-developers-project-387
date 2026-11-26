import type { FastifyReply } from 'fastify';
import type { ApiError, ErrorCode, FieldError } from './generated/types.gen.ts';

// Статус однозначно следует из кода ошибки (спецификация EMIR1HUB/ai-for-developers-project-386#11, раздел «Ошибки»),
// поэтому маршруты передают только код, и пара «код — статус» не расходится между ручками
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  MALFORMED_REQUEST: 400,
  EVENT_TYPE_NOT_FOUND: 404,
  NOT_FOUND: 404,
  EVENT_TYPE_ID_TAKEN: 409,
  SLOT_TAKEN: 409,
  VALIDATION_ERROR: 422,
  SLOT_NOT_OFFERED: 422,
  INTERNAL_ERROR: 500,
};

/** Одно сообщение для ручек, которые ищут тип встречи по идентификатору (`404 EVENT_TYPE_NOT_FOUND`) */
export const EVENT_TYPE_NOT_FOUND_MESSAGE = 'Тип встречи не найден';

/**
 * Отказ в общей схеме, который можно бросить из маршрута или помощника (например, из `parseBody`).
 * Общий обработчик ошибок приложения отправляет его через `sendError`.
 */
export class ApiFailure extends Error {
  readonly code: ErrorCode;
  readonly fields: FieldError[] | undefined;

  constructor(code: ErrorCode, message: string, fields?: FieldError[]) {
    super(message);
    this.name = 'ApiFailure';
    this.code = code;
    this.fields = fields;
  }
}

/** Отправляет ошибку в общей схеме `{ code, message, fields? }` со статусом, который задан для кода */
export function sendError(
  reply: FastifyReply,
  code: ErrorCode,
  message: string,
  fields?: FieldError[],
): FastifyReply {
  const body: ApiError = fields ? { code, message, fields } : { code, message };
  return reply.status(STATUS_BY_CODE[code]).send(body);
}
