import { ApiFailure } from './errors.ts';
import type { FieldError } from './generated/types.gen.ts';
import { MINUTE_MS } from './ownerTime.ts';

export const MALFORMED_BODY_MESSAGE = 'Тело запроса должно быть JSON-объектом';
const VALIDATION_MESSAGE = 'Поля заполнены неверно';
const REQUIRED_MESSAGE = 'Обязательное поле';
const NOT_STRING_MESSAGE = 'Должно быть строкой';
const NOT_INTEGER_MESSAGE = 'Должно быть целым числом';
const EMAIL_MESSAGE = 'Неверный формат email';
const OFFSET_DATE_TIME_MESSAGE =
  'Время в формате ISO 8601 со смещением, например 2026-11-25T10:00:00+05:00';

// Граница длины адреса из RFC 5321; формат проверяется упрощённо: одна `@`, без пробелов, точка в домене
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// ISO 8601 с обязательным смещением или `Z`: без смещения момент неоднозначен (спецификация EMIR1HUB/ai-for-developers-project-386#11, «Время»)
const OFFSET_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(?<offset>Z|(?<sign>[+-])(?<hours>\d{2}):(?<minutes>\d{2}))$/;

/** Момент из ISO 8601 со смещением; `undefined`, если формат не тот или такого времени нет в календаре */
function parseOffsetDateTime(value: string): Date | undefined {
  const groups = OFFSET_DATE_TIME_PATTERN.exec(value)?.groups;
  const moment = new Date(value);
  if (!groups || Number.isNaN(moment.getTime())) {
    return undefined;
  }
  // V8 переносит несуществующие даты вперёд (`2026-11-31` → 1 декабря, `24:00` → следующий день),
  // поэтому сверяем, что дата и часы, пересчитанные обратно в то же смещение, не сдвинулись
  const offsetMinutes =
    groups.offset === 'Z'
      ? 0
      : (groups.sign === '-' ? -1 : 1) * (Number(groups.hours) * 60 + Number(groups.minutes));
  const local = new Date(moment.getTime() + offsetMinutes * MINUTE_MS).toISOString();
  return local.slice(0, 16) === value.slice(0, 16) ? moment : undefined;
}

export interface StringRules {
  /** По умолчанию 0: пустая строка допустима */
  minLength?: number;
  maxLength: number;
  pattern?: RegExp;
  /** Текст ошибки, если строка не подходит под `pattern` */
  patternMessage?: string;
}

export interface IntegerRules {
  min: number;
  max: number;
  /** Значение должно быть кратно шагу */
  step: number;
  /** Текст ошибки при выходе за границы или шаг */
  message: string;
}

/**
 * Читает поля тела запроса и копит ошибки, не прерываясь на первой: ответ `422` перечисляет
 * все ошибочные поля сразу. Имя поля — путь через точку (`guest.name`), он же попадает в `field`.
 * При ошибке метод возвращает заглушку; `parseBody` всё равно не отдаст результат дальше.
 */
export interface FieldReader {
  /** Обязательная строка. Пробелы по краям обрезаются до проверки, строка из пробелов — пустая */
  string(field: string, rules: StringRules): string;
  /** Необязательная строка: нет поля, `null` или строка из пробелов — `undefined` */
  optionalString(field: string, rules: StringRules): string | undefined;
  /** Обязательный email до 254 символов, возвращается как введён (без пробелов по краям) */
  email(field: string): string;
  /** Обязательный момент времени ISO 8601 со смещением или `Z` */
  offsetDateTime(field: string): Date;
  /** Обязательное целое число */
  integer(field: string, rules: IntegerRules): number;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueAt(body: JsonObject, field: string): unknown {
  let value: unknown = body;
  for (const key of field.split('.')) {
    value = isJsonObject(value) ? value[key] : undefined;
  }
  return value;
}

function lengthMessage(minLength: number, maxLength: number): string {
  return minLength > 1
    ? `Длина от ${minLength} до ${maxLength} символов`
    : `Не длиннее ${maxLength} символов`;
}

/**
 * Проверяет тело запроса и возвращает то, что собрала `read`.
 * Тело не JSON-объект — `ApiFailure` `MALFORMED_REQUEST` (400); хотя бы одно поле невалидно —
 * `ApiFailure` `VALIDATION_ERROR` (422) со всеми ошибочными полями.
 */
export function parseBody<T>(body: unknown, read: (fields: FieldReader) => T): T {
  if (!isJsonObject(body)) {
    throw new ApiFailure('MALFORMED_REQUEST', MALFORMED_BODY_MESSAGE);
  }

  const errors: FieldError[] = [];
  const reject = (field: string, message: string) => {
    errors.push({ field, message });
  };

  const checkString = (
    field: string,
    value: string,
    { minLength = 0, maxLength, pattern, patternMessage }: StringRules,
  ) => {
    // Длина в символах Unicode, как `maxLength` в JSON Schema, а не в UTF-16
    const length = [...value].length;
    if (length === 0 && minLength > 0) {
      reject(field, REQUIRED_MESSAGE);
    } else if (length < minLength || length > maxLength) {
      reject(field, lengthMessage(minLength, maxLength));
    } else if (pattern && !pattern.test(value)) {
      reject(field, patternMessage ?? 'Неверный формат');
    }
  };

  const reader: FieldReader = {
    string(field, rules) {
      const raw = valueAt(body, field);
      if (raw === undefined || raw === null) {
        reject(field, REQUIRED_MESSAGE);
        return '';
      }
      if (typeof raw !== 'string') {
        reject(field, NOT_STRING_MESSAGE);
        return '';
      }
      const value = raw.trim();
      checkString(field, value, rules);
      return value;
    },

    optionalString(field, rules) {
      const raw = valueAt(body, field);
      if (raw === undefined || raw === null) {
        return undefined;
      }
      if (typeof raw !== 'string') {
        reject(field, NOT_STRING_MESSAGE);
        return undefined;
      }
      const value = raw.trim();
      if (value === '') {
        return undefined;
      }
      checkString(field, value, rules);
      return value;
    },

    email(field) {
      return reader.string(field, {
        minLength: 1,
        maxLength: EMAIL_MAX_LENGTH,
        pattern: EMAIL_PATTERN,
        patternMessage: EMAIL_MESSAGE,
      });
    },

    offsetDateTime(field) {
      const raw = valueAt(body, field);
      if (raw === undefined || raw === null) {
        reject(field, REQUIRED_MESSAGE);
        return new Date(Number.NaN);
      }
      if (typeof raw !== 'string') {
        reject(field, NOT_STRING_MESSAGE);
        return new Date(Number.NaN);
      }
      const value = raw.trim();
      const moment = parseOffsetDateTime(value);
      if (!moment) {
        reject(field, value === '' ? REQUIRED_MESSAGE : OFFSET_DATE_TIME_MESSAGE);
        return new Date(Number.NaN);
      }
      return moment;
    },

    integer(field, { min, max, step, message }) {
      const raw = valueAt(body, field);
      if (raw === undefined || raw === null) {
        reject(field, REQUIRED_MESSAGE);
        return 0;
      }
      if (typeof raw !== 'number' || !Number.isInteger(raw)) {
        reject(field, NOT_INTEGER_MESSAGE);
        return 0;
      }
      if (raw < min || raw > max || raw % step !== 0) {
        reject(field, message);
      }
      return raw;
    },
  };

  const result = read(reader);
  if (errors.length > 0) {
    throw new ApiFailure('VALIDATION_ERROR', VALIDATION_MESSAGE, errors);
  }
  return result;
}
