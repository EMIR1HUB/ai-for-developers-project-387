# AGENTS.md

Сервис записи на звонок (упрощённый Cal.com). Сценарий, требования и правила бронирования описаны в [README.md](README.md).

Приложение перенесено из проекта [EMIR1HUB/ai-for-developers-project-386](https://github.com/EMIR1HUB/ai-for-developers-project-386). Новые задачи — в трекере этого репозитория, а исходная спецификация (`EMIR1HUB/ai-for-developers-project-386#11`) и решения (`#1–#10` там же) остаются в трекере 386, ссылки на них в README.md, раздел «Исходный проект». На них ссылаются только полным адресом: голый `#11` здесь означает задачу этого репозитория.

## Команды

Окружение и задачи описаны в `mise.toml`. Команды запуска, проверок и генерации собраны в таблице README.md, раздел «Использование». Главное:

- `mise run check`: линтеры, типы, тесты и браузерные сценарии (`mise run e2e`), его же запускает CI. Перед коммитом должен быть зелёным.
- `mise run dev`: бэкенд на `:3000` и фронтенд на `:5173` фоновыми daemons (`mise daemons ls | logs | stop`).
- `mise run e2e`: собирает фронтенд и прогоняет Playwright (Chromium) на своём сервере `127.0.0.1:4173`. Порт должен быть свободен, dev-серверы `:3000`/`:5173` сценариям не мешают. Chromium скачивает `mise run browsers` (postinstall-хук).
- Один тест: `npm test -w @calendar/backend -- test/health.test.ts`, `npm test -w @calendar/frontend -- -t "<имя теста>"` или `npm run e2e -w @calendar/e2e -- -g "<имя теста>"` (после `npm run build -w @calendar/frontend`).

## Генерируемые файлы

Эти пути создаёт `mise run generate`. Руками их не правят: правка вносится в `api/main.tsp`, затем запускается генерация.

| Путь                          | Из чего            | В git                                                           |
| ----------------------------- | ------------------ | --------------------------------------------------------------- |
| `api/openapi.yaml`            | `api/main.tsp`     | да, CI проверяет, что после `mise run generate` он не изменился |
| `backend/src/generated/`      | `api/openapi.yaml` | нет (`.gitignore`)                                              |
| `frontend/src/api/generated/` | `api/openapi.yaml` | нет (`.gitignore`)                                              |

После изменения контракта выполни `mise run generate` и закоммить `api/openapi.yaml`. Задачи `typecheck`, `test` и `dev` перегенерируют код сами.

## Устройство

- Источник правды для API: `api/main.tsp`. Тело любой ошибки — модель `ApiError` `{ code, message, fields? }`, `code` из закрытого перечисления `ErrorCode`; ответ с ошибкой описывается как `ErrorResponse<статус>`.
- Бэкенд: Node запускает `.ts` без сборки (type stripping), поэтому относительные импорты пишутся с расширением `.ts`. Маршруты Fastify пишутся вручную по контракту (`src/routes/`), типы запросов и ответов берутся из `generated`. `buildApp(options)` в `src/app.ts` нужен тестам (`app.inject`), а `src/server.ts` только слушает порт.
- Бэкенд: «сейчас» берётся только из часов `now` в `AppContext`, данные — из хранилища в памяти `src/store.ts` (ADR-0002, методы синхронные). Ошибки отправляются только через `sendError` из `src/errors.ts`: статус следует из кода. Маршрут или помощник может вместо этого бросить `ApiFailure` (там же), общий обработчик отправит её через `sendError`. `DEMO_DATA=false` выключает демо-типы встреч.
- Бэкенд: тело запроса читается только через `parseBody(request.body, read)` из `src/validation.ts`. Он обрезает пробелы по краям строк до проверки, копит ошибки всех полей и бросает `422 VALIDATION_ERROR` с полным `fields` (вложенные поля через точку: `fields.string('guest.name', …)`); тело не JSON-объект — `400 MALFORMED_REQUEST`. Тело, которое Fastify не смог разобрать (битый JSON, неизвестный `Content-Type`), общий обработчик тоже отдаёт как `400 MALFORMED_REQUEST`. `FieldReader` читает обязательную и необязательную строку, email, целое число и момент времени ISO 8601 со смещением (`offsetDateTime`: без смещения или с несуществующей датой — `422`). Новое правило поля добавляется в `FieldReader` там же.
- Бэкенд: слоты считает чистая функция `computeSlots(eventType, bookings, now)` в `src/slots.ts`, правило пересечения `[start, end)` — `intervalsOverlap` там же. Время внутри — `Date`, в строку со смещением владельца `+05:00` его переводит `formatOwnerTime` (`src/ownerTime.ts`) на границе API.
- Бэкенд: создание бронирования (`src/routes/bookings.ts`) берёт слот через `findOfferedSlot` (`src/slots.ts`, поверх `computeSlots`): сервер принимает ровно то начало, что показывает ручка слотов и что ещё не наступило, иначе `422 SLOT_NOT_OFFERED` с причиной. Ручка слотов отдаёт и начавшиеся слоты, но с `available: false`. Пересечение ищется через `intervalsOverlap` по бронированиям всех типов. От поиска слота до `store.addBooking` нельзя вставлять `await` (ADR-0002): на этом держится защита от одновременных запросов. Бронирование в ответ переводит `toBookingResponse` там же. `GET /api/bookings` отдаёт предстоящие бронирования из `store.listUpcomingBookings(now)`: ещё не закончились (`end > now`), по возрастанию начала.
- Бэкенд: при заданной `STATIC_DIR` (опция `staticDir` у `buildApp`) Fastify раздаёт собранный фронтенд через `@fastify/static` с `wildcard: false`: маршруты только на файлы, что лежат в папке при старте, поэтому папку собирают до запуска. Неизвестный адрес на `GET`/`HEAD` получает `index.html` (SPA), остальное — JSON `404 NOT_FOUND`. Для `/api` свой обработчик 404 в плагине с префиксом `/api`: неизвестный `/api/*` всегда JSON, а не `index.html`.
- API-тесты бэкенда собирают приложение через `buildTestApp()` (`test/support/testApp.ts`: фиксированные часы, без демо-данных) и сверяют каждый ответ с контрактом через `expectResponseToMatchContract(response, operationId)` (`test/support/contract.ts`).
- Фронтенд вызывает API только через сгенерированный SDK, прямой `fetch` запрещён правилом oxlint. `baseUrl` задаётся в `src/api/client-config.ts`. В dev Vite проксирует `/api` на `127.0.0.1:3000`. Данные страниц грузит `useApiQuery` (`src/api/useApiQuery.ts`), текст ошибки даёт `errorMessage`, ошибки полей из `422 VALIDATION_ERROR` — `fieldErrors` (оба в `src/api/errors.ts`). Уведомления показывает `notifications.show` из `@mantine/notifications`.
- Фронтенд показывает время из строки ответа без пересчёта в пояс браузера: помощники в `src/ownerTime.ts`. Тесты фронтенда идут в поясе `America/Los_Angeles` (`vite.config.ts`), чтобы случайный пересчёт ронял их на любой машине.
- Страница бронирования (`src/pages/booking/`) — шаги на одном адресе: `BookingPage` хранит тип встречи, слоты, выбор гостя, текущий шаг и введённые данные гостя; шаги `TimeSelectionStep` → `GuestDetailsStep` (форма и отправка) → `ConfirmationStep` показывают их. `409 SLOT_TAKEN` и `422 SLOT_NOT_OFFERED` возвращают к выбору времени с уведомлением и перезагрузкой слотов, данные формы остаются.
- Админка (`src/pages/AdminPage.tsx`) состоит из разделов в `src/pages/admin/`: `UpcomingBookingsSection` (таблица предстоящих бронирований, подпись пояса из профиля владельца) и `EventTypesSection` (список и форма `EventTypeForm`).
- Тесты фронтенда рендерят приложение по адресу (`renderApp`) и подменяют сеть MSW: `server.use(mockApi('<операция>', статус, тело))` из `src/test/mockApi.ts`, обработчики типизированы сгенерированными типами. Тело запроса страницы тест получает через четвёртый аргумент `mockApi` (`onRequest`). Новая операция контракта добавляется в `ApiOperations` и `OPERATIONS` там же. Запрос без обработчика роняет тест.
- Браузерные сценарии лежат в workspace `e2e/` (`playwright.config.ts`, `tests/`). Playwright сам запускает `backend/src/server.ts` на `:4173` с `DEMO_DATA=false` и `STATIC_DIR=frontend/dist`. Ответы API не подменяются (никаких `page.route` и MSW): сценарий готовит данные и занимает слоты настоящими запросами через фикстуру `request`. Время реальное, слот берётся из ответа ручки слотов. Сервер и расписание общие на все сценарии, поэтому они идут в один worker, а идентификаторы, названия и email делаются уникальными на каждый прогон. Элементы ищутся по ролям и подписям (`getByRole`), как видит их пользователь.
- Образ и деплой: `Dockerfile` собирает один образ (фронтенд раздаёт сам Fastify, порт из `PORT`, версия Node как в `mise.toml`), job `docker` в `ci.yml` проверяет, что контейнер стартует. Сервис на Render описан в `render.yaml` (Blueprint), MCP Render — в `.mcp.json`. Ключ `RENDER_API_KEY` берётся только из окружения: ни в `.mcp.json`, ни в других файлах репозитория значения ключей и токенов не пишутся. Данные хранятся в памяти и сбрасываются при перезапуске и засыпании сервиса (README, «Деплой»).
- TypeScript закреплён на 6.x: в TS 7 нет JS API компилятора, и генератор Hey API на нём падает.

## Правила

- Коммиты пишутся по Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Хук commit-msg проверяет их через commitlint.
- Коммит ссылается на тикет GitHub Issues в футере сообщения: `Refs #N` для промежуточных коммитов, `Closes #N` для коммита, который завершает тикет (тикет закроется, когда коммит попадёт в `main`). Номер тикета берётся из задачи, по которой идёт работа.
- Релизы выпускает release-please (README.md, раздел «Релизы»). `CHANGELOG.md` и `.release-please-manifest.json` руками не править. Заголовок PR в `main` пишется по Conventional Commits: при squash-merge он становится коммитом и строкой changelog.
- `.github/workflows/hexlet-check.yml` не редактировать и не переименовывать.
- Доменные понятия называй терминами из [GLOSSARY.md](GLOSSARY.md), архитектурные решения лежат в `docs/adr/`.

## Agent skills

Набор [mattpocock/skills](https://github.com/mattpocock/skills) установлен в проект: `.claude/skills/`, версии в `skills-lock.json`. Вызывай скиллы по короткому имени (`/wayfinder`, `/implement-spec`), а не из глобального плагина `mattpocock-skills:*`. Обновление: `npx skills update -p`.

### Issue tracker

Задачи и спеки ведутся в GitHub Issues репозитория через `gh`. См. `docs/agents/issue-tracker.md`.

### Triage labels

Стандартные пять меток: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Один контекст: `GLOSSARY.md` и `docs/adr/` в корне. См. `docs/agents/domain.md`.
