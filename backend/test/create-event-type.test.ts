import { describe, expect, it } from 'vitest';
import { expectResponseToMatchContract } from './support/contract.ts';
import { buildTestApp } from './support/testApp.ts';

const VALID_EVENT_TYPE = {
  id: 'intro-15',
  title: 'Встреча 15 минут',
  description: 'Короткое знакомство',
  durationMinutes: 15,
};

const ID_FORMAT_MESSAGE =
  'Только строчные латинские буквы, цифры и дефис; дефис не в начале, не в конце и не подряд';

describe('POST /api/event-types', () => {
  it('should respond 201 with created event type and list it when fields are valid', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      payload: VALID_EVENT_TYPE,
    });

    // then
    expect(response.statusCode).toBe(201);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual({
      id: 'intro-15',
      title: 'Встреча 15 минут',
      description: 'Короткое знакомство',
      durationMinutes: 15,
    });
    const list = await app.inject({ method: 'GET', url: '/api/event-types' });
    expect(expectResponseToMatchContract(list, 'EventTypes_list')).toEqual([
      {
        id: 'intro-15',
        title: 'Встреча 15 минут',
        description: 'Короткое знакомство',
        durationMinutes: 15,
      },
    ]);
  });

  it('should respond 409 EVENT_TYPE_ID_TAKEN and keep existing event type when id is taken', async () => {
    // given
    const app = buildTestApp();
    await app.inject({ method: 'POST', url: '/api/event-types', payload: VALID_EVENT_TYPE });

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      payload: { ...VALID_EVENT_TYPE, title: 'Другая встреча', durationMinutes: 60 },
    });

    // then
    expect(response.statusCode).toBe(409);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual({
      code: 'EVENT_TYPE_ID_TAKEN',
      message: 'Идентификатор уже занят. Выберите другой',
    });
    const list = await app.inject({ method: 'GET', url: '/api/event-types' });
    expect(expectResponseToMatchContract(list, 'EventTypes_list')).toEqual([VALID_EVENT_TYPE]);
  });

  it('should respond 422 listing every field when all fields are missing', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({ method: 'POST', url: '/api/event-types', payload: {} });

    // then
    expect(response.statusCode).toBe(422);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Поля заполнены неверно',
      fields: [
        { field: 'id', message: 'Обязательное поле' },
        { field: 'title', message: 'Обязательное поле' },
        { field: 'description', message: 'Обязательное поле' },
        { field: 'durationMinutes', message: 'Обязательное поле' },
      ],
    });
    const list = await app.inject({ method: 'GET', url: '/api/event-types' });
    expect(expectResponseToMatchContract(list, 'EventTypes_list')).toEqual([]);
  });

  it('should respond 422 listing every invalid field at once when several rules are broken', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      payload: {
        id: 'Intro 15',
        title: '   ',
        description: 'д'.repeat(501),
        durationMinutes: 20,
      },
    });

    // then
    expect(response.statusCode).toBe(422);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Поля заполнены неверно',
      fields: [
        { field: 'id', message: ID_FORMAT_MESSAGE },
        { field: 'title', message: 'Обязательное поле' },
        { field: 'description', message: 'Не длиннее 500 символов' },
        { field: 'durationMinutes', message: 'От 15 до 240 минут с шагом 15' },
      ],
    });
  });

  it.each([
    { id: 'ab', message: 'Длина от 3 до 50 символов' },
    { id: 'a'.repeat(51), message: 'Длина от 3 до 50 символов' },
    { id: '   ', message: 'Обязательное поле' },
    { id: 'Intro-15', message: ID_FORMAT_MESSAGE },
    { id: 'intro_15', message: ID_FORMAT_MESSAGE },
    { id: 'встреча', message: ID_FORMAT_MESSAGE },
    { id: '-intro', message: ID_FORMAT_MESSAGE },
    { id: 'intro-', message: ID_FORMAT_MESSAGE },
    { id: 'intro--15', message: ID_FORMAT_MESSAGE },
    { id: 15, message: 'Должно быть строкой' },
  ])('should respond 422 for id when id is $id', async ({ id, message }) => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      payload: { ...VALID_EVENT_TYPE, id },
    });

    // then
    expect(response.statusCode).toBe(422);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Поля заполнены неверно',
      fields: [{ field: 'id', message }],
    });
  });

  it.each([
    { field: 'title', value: '', message: 'Обязательное поле' },
    { field: 'title', value: 'н'.repeat(101), message: 'Не длиннее 100 символов' },
    { field: 'description', value: 'о'.repeat(501), message: 'Не длиннее 500 символов' },
    { field: 'durationMinutes', value: 0, message: 'От 15 до 240 минут с шагом 15' },
    { field: 'durationMinutes', value: 10, message: 'От 15 до 240 минут с шагом 15' },
    { field: 'durationMinutes', value: 25, message: 'От 15 до 240 минут с шагом 15' },
    { field: 'durationMinutes', value: 255, message: 'От 15 до 240 минут с шагом 15' },
    { field: 'durationMinutes', value: 15.5, message: 'Должно быть целым числом' },
    { field: 'durationMinutes', value: '30', message: 'Должно быть целым числом' },
  ])(
    'should respond 422 for $field when $field breaks the rule: $message',
    async ({ field, value, message }) => {
      // given
      const app = buildTestApp();

      // when
      const response = await app.inject({
        method: 'POST',
        url: '/api/event-types',
        payload: { ...VALID_EVENT_TYPE, [field]: value },
      });

      // then
      expect(response.statusCode).toBe(422);
      expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Поля заполнены неверно',
        fields: [{ field, message }],
      });
    },
  );

  it('should accept boundary values when lengths and duration are at their limits', async () => {
    // given
    const app = buildTestApp();
    const eventType = {
      id: 'a'.repeat(50),
      title: 'н'.repeat(100),
      description: 'о'.repeat(500),
      durationMinutes: 240,
    };

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      payload: eventType,
    });

    // then
    expect(response.statusCode).toBe(201);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual(eventType);
  });

  it('should trim spaces around strings before checking and saving when fields have padding', async () => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      payload: {
        id: '  call-30\t',
        title: '  Встреча 30 минут  ',
        description: '   ',
        durationMinutes: 30,
      },
    });

    // then
    expect(response.statusCode).toBe(201);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual({
      id: 'call-30',
      title: 'Встреча 30 минут',
      description: '',
      durationMinutes: 30,
    });
    const list = await app.inject({ method: 'GET', url: '/api/event-types' });
    expect(expectResponseToMatchContract(list, 'EventTypes_list')).toEqual([
      { id: 'call-30', title: 'Встреча 30 минут', description: '', durationMinutes: 30 },
    ]);
  });

  it.each([
    { reason: 'json is broken', contentType: 'application/json', payload: '{"id": "intro-15",' },
    { reason: 'json body is empty', contentType: 'application/json', payload: '' },
    { reason: 'body is plain text', contentType: 'text/plain', payload: 'intro-15' },
    { reason: 'body has unsupported type', contentType: 'application/xml', payload: '<id/>' },
    { reason: 'json is an array', contentType: 'application/json', payload: '[]' },
    { reason: 'json is null', contentType: 'application/json', payload: 'null' },
  ])('should respond 400 MALFORMED_REQUEST when $reason', async ({ contentType, payload }) => {
    // given
    const app = buildTestApp();

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      headers: { 'content-type': contentType },
      payload,
    });

    // then
    expect(response.statusCode).toBe(400);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toEqual({
      code: 'MALFORMED_REQUEST',
      message: 'Тело запроса должно быть JSON-объектом',
    });
  });

  it('should respond 409 when trimmed id matches an existing event type', async () => {
    // given
    const app = buildTestApp();
    await app.inject({ method: 'POST', url: '/api/event-types', payload: VALID_EVENT_TYPE });

    // when
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      payload: { ...VALID_EVENT_TYPE, id: ' intro-15 ' },
    });

    // then
    expect(response.statusCode).toBe(409);
    expect(expectResponseToMatchContract(response, 'EventTypes_create')).toMatchObject({
      code: 'EVENT_TYPE_ID_TAKEN',
    });
  });
});
