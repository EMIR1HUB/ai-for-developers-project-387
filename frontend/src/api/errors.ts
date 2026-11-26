import type { ApiError } from './generated/types.gen';

const CONNECTION_ERROR_MESSAGE = 'Не удалось связаться с сервером';

/** Ошибка в общей схеме API. Сетевая ошибка приходит из SDK как `TypeError` и сюда не подходит */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ApiError).code === 'string' &&
    typeof (error as ApiError).message === 'string'
  );
}

/**
 * Текст для пользователя: `message` сервера как есть. Для сетевой ошибки и `INTERNAL_ERROR`
 * (непредвиденная `500`) — сообщение о недоступности сервера (спецификация EMIR1HUB/ai-for-developers-project-386#11, раздел «Интерфейс»)
 */
export function errorMessage(error: unknown): string {
  if (!isApiError(error) || error.code === 'INTERNAL_ERROR') {
    return CONNECTION_ERROR_MESSAGE;
  }
  return error.message;
}

/** Ошибки полей формы, ключ — имя поля из ответа (вложенные поля через точку) */
export type FieldErrors = Partial<Record<string, string>>;

/** Ошибки полей из `422 VALIDATION_ERROR`; для любой другой ошибки — пустой объект */
export function fieldErrors(error: unknown): FieldErrors {
  if (!isApiError(error) || error.code !== 'VALIDATION_ERROR') {
    return {};
  }
  return Object.fromEntries((error.fields ?? []).map(({ field, message }) => [field, message]));
}
