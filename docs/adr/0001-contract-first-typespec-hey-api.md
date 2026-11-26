# Contract-first: TypeSpec → OpenAPI → Hey API, без серверного генератора

API описывается в `api/main.tsp`, из него собирается коммитящийся `api/openapi.yaml`, а из OpenAPI Hey API генерирует и SDK фронтенда, и типы бэкенда. Маршруты Fastify пишутся вручную по сгенерированным типам и проверяются тестами.

## Considered Options

- `@typespec/http-server-js`: официальный серверный эмиттер, но помечен как highly experimental.
- `openapi-typescript` для типов бэкенда: требует TypeScript 5.x и конфликтует с выбранной версией TS; второй генератор рядом с Hey API размножил бы способы получать типы.
- TypeScript 7: в нём нет JS API компилятора, и Hey API на нём падает, поэтому TS закреплён на 6.x.
