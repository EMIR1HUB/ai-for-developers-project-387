import { readFileSync } from 'node:fs';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';
import { parse } from 'yaml';

type JsonSchema = Record<string, unknown>;

interface OpenApiOperation {
  operationId: string;
  responses: Record<string, { content?: { 'application/json'?: { schema: JsonSchema } } }>;
}

interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: Record<string, JsonSchema> };
}

// Сверяем с закоммиченным OpenAPI, а не с TypeSpec: это тот же контракт, по которому генерируется SDK
const SPEC_ID = 'openapi.yaml';
const spec = parse(
  readFileSync(new URL('../../../api/openapi.yaml', import.meta.url), 'utf8'),
) as OpenApiDocument;

// OpenAPI 3.1 описывает схемы на JSON Schema 2020-12; ссылки `#/components/...` разрешаются
// внутри документа, поэтому он регистрируется целиком
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
ajv.addSchema(spec, SPEC_ID);

const validators = new Map<string, ValidateFunction>();

function validatorFor(pointer: string): ValidateFunction {
  let validate = validators.get(pointer);
  if (!validate) {
    validate = ajv.compile({ $ref: `${SPEC_ID}#${pointer}` });
    validators.set(pointer, validate);
  }
  return validate;
}

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function findOperation(operationId: string): { path: string; method: string } {
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation.operationId === operationId) {
        return { path, method };
      }
    }
  }
  throw new Error(`Операция ${operationId} не описана в api/openapi.yaml`);
}

function expectValid(validate: ValidateFunction, body: unknown, context: string): void {
  validate(body);
  expect(validate.errors ?? [], `${context}: тело ответа не соответствует схеме`).toEqual([]);
}

/**
 * Проверяет, что статус ответа объявлен у операции в OpenAPI, а JSON-тело соответствует схеме
 * этого статуса. Возвращает разобранное тело для дальнейших проверок.
 */
export function expectResponseToMatchContract(
  response: LightMyRequestResponse,
  operationId: string,
): unknown {
  const { path, method } = findOperation(operationId);
  const status = String(response.statusCode);
  const declared = spec.paths[path]?.[method]?.responses ?? {};

  expect(
    Object.keys(declared),
    `${operationId}: статус ${status} не объявлен в контракте`,
  ).toContain(status);

  const body: unknown = response.json();
  if (declared[status]?.content?.['application/json']) {
    const pointer = `/paths/${escapePointer(path)}/${method}/responses/${status}/content/application~1json/schema`;
    expectValid(validatorFor(pointer), body, `${operationId} ${status}`);
  }
  return body;
}

/**
 * Проверяет тело ответа по именованной схеме из `components.schemas`. Нужна для ответов,
 * у которых нет операции в контракте, например `404 NOT_FOUND` на неизвестный адрес под `/api`.
 */
export function expectBodyToMatchSchema(
  response: LightMyRequestResponse,
  schemaName: string,
): unknown {
  if (!spec.components.schemas[schemaName]) {
    throw new Error(`Схема ${schemaName} не описана в api/openapi.yaml`);
  }
  const body: unknown = response.json();
  expectValid(validatorFor(`/components/schemas/${escapePointer(schemaName)}`), body, schemaName);
  return body;
}
