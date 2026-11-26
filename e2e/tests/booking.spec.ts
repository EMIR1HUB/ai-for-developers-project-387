import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { EventType, NewBooking, Slot } from '../../frontend/src/api/generated/types.gen.ts';

// Тесты идут на реальном времени: слот не задаётся заранее, а берётся из ответа ручки слотов.
// Слот, который начнётся меньше чем через этот запас, мог бы начаться за время теста,
// и сервер отказал бы с SLOT_NOT_OFFERED. Поэтому «первый свободный» — первый из тех,
// что начнутся не раньше чем через запас
const SLOT_START_MARGIN_MS = 2 * 60 * 1000;

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/**
 * Уникальная метка запуска для идентификатора, названия и email: сценарии и их повторы
 * (`--repeat-each`) не зависят друг от друга, а строки в каталоге и админке не совпадают
 */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** `2026-11-25T10:00:00+05:00` → `25 ноября`: так день подписан в календаре */
function dayLabel(time: string): string {
  const month = Number(time.slice(5, 7));
  const day = Number(time.slice(8, 10));
  return `${day} ${MONTHS_GENITIVE[month - 1]}`;
}

/** `10:00–10:30`: время слота по поясу владельца, как его отдал сервер */
function timeRange(slot: Slot): string {
  return `${slot.start.slice(11, 16)}–${slot.end.slice(11, 16)}`;
}

async function fetchSlots(request: APIRequestContext, eventTypeId: string): Promise<Slot[]> {
  const response = await request.get(`/api/event-types/${eventTypeId}/slots`);
  expect(response.status()).toBe(200);
  return (await response.json()) as Slot[];
}

async function firstFreeSlot(request: APIRequestContext, eventTypeId: string): Promise<Slot> {
  const earliestStart = Date.now() + SLOT_START_MARGIN_MS;
  const slot = (await fetchSlots(request, eventTypeId)).find(
    (candidate) => candidate.available && Date.parse(candidate.start) >= earliestStart,
  );
  if (!slot) {
    throw new Error(`В окне записи нет свободных слотов для ${eventTypeId}`);
  }
  return slot;
}

/** Выбор дня и слота на шаге «выбор времени» */
async function chooseSlot(page: Page, slot: Slot): Promise<void> {
  await expect(page.getByRole('region', { name: 'Слоты дня' })).toBeVisible();
  // По умолчанию открыт первый день со свободными слотами; нужный день может быть следующим,
  // в том числе в следующем месяце
  const day = page.getByRole('button', { name: new RegExp(`^${dayLabel(slot.start)},`) });
  if (!(await day.isVisible())) {
    await page.getByRole('button', { name: 'Следующий месяц' }).click();
  }
  await day.click();
  await page.getByRole('button', { name: `${timeRange(slot)} Свободно`, exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить' }).click();
}

test('should show booking in admin when guest books first free slot of type created by owner', async ({
  page,
  request,
}) => {
  // given
  const suffix = uniqueSuffix();
  const eventType: EventType = {
    id: `e2e-call-${suffix}`,
    title: `Созвон по проекту ${suffix}`,
    description: 'Обсудим задачу и сроки.',
    durationMinutes: 30,
  };
  const guest = {
    name: 'Анна Гостева',
    email: `anna-${suffix}@example.com`,
    note: 'Хочу обсудить сроки',
  };

  await page.goto('/admin');
  const form = page.getByRole('form', { name: 'Новый тип встречи' });
  await form.getByRole('textbox', { name: 'Идентификатор' }).fill(eventType.id);
  await form.getByRole('textbox', { name: 'Название' }).fill(eventType.title);
  await form.getByRole('textbox', { name: 'Описание' }).fill(eventType.description);
  await form.getByRole('combobox', { name: 'Длительность' }).selectOption('30 мин');
  await form.getByRole('button', { name: 'Создать тип встречи' }).click();
  await expect(page.getByText('Тип встречи создан')).toBeVisible();

  // when
  await page.goto('/book');
  await page.getByRole('link', { name: eventType.title }).click();
  await expect(page).toHaveURL(`/book/${eventType.id}`);
  const slot = await firstFreeSlot(request, eventType.id);
  await chooseSlot(page, slot);

  await page.getByRole('textbox', { name: 'Имя' }).fill(guest.name);
  await page.getByRole('textbox', { name: 'Email' }).fill(guest.email);
  await page.getByRole('textbox', { name: 'Заметка' }).fill(guest.note);
  await page.getByRole('button', { name: 'Забронировать' }).click();

  // then
  const confirmation = page.getByRole('region', { name: 'Бронирование создано' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(eventType.title);
  await expect(confirmation).toContainText(timeRange(slot));
  await expect(confirmation).toContainText(guest.email);

  await page.goto('/admin');
  const bookingRow = page
    .getByRole('table', { name: 'Предстоящие бронирования' })
    .getByRole('row', { name: guest.email });
  await expect(bookingRow).toContainText(`${dayLabel(slot.start)}, ${timeRange(slot)}`);
  await expect(bookingRow).toContainText(eventType.title);
  await expect(bookingRow).toContainText(guest.name);
  await expect(bookingRow).toContainText(guest.note);
});

test('should keep guest details and show conflict when chosen slot is taken via API meanwhile', async ({
  page,
  request,
}) => {
  // given
  const suffix = uniqueSuffix();
  const eventType: EventType = {
    id: `e2e-race-${suffix}`,
    title: `Короткий созвон ${suffix}`,
    description: '',
    durationMinutes: 15,
  };
  const created = await request.post('/api/event-types', { data: eventType });
  expect(created.status()).toBe(201);
  const guest = { name: 'Борис Гостев', email: 'boris@example.com', note: 'Перезвоните, если что' };

  await page.goto(`/book/${eventType.id}`);
  const slot = await firstFreeSlot(request, eventType.id);
  await chooseSlot(page, slot);
  await page.getByRole('textbox', { name: 'Имя' }).fill(guest.name);
  await page.getByRole('textbox', { name: 'Email' }).fill(guest.email);
  await page.getByRole('textbox', { name: 'Заметка' }).fill(guest.note);

  // Другой гость успевает занять то же время, пока первый заполняет форму
  const rival: NewBooking = {
    eventTypeId: eventType.id,
    start: slot.start,
    guestName: 'Соперник',
    guestEmail: 'rival@example.com',
  };
  const rivalBooking = await request.post('/api/bookings', { data: rival });
  expect(rivalBooking.status()).toBe(201);

  // when
  await page.getByRole('button', { name: 'Забронировать' }).click();

  // then
  await expect(page.getByText('Это время уже заняли. Выберите другой слот')).toBeVisible();
  await expect(
    page.getByRole('button', { name: `${timeRange(slot)} Занято`, exact: true }),
  ).toBeDisabled();

  const nextSlot = await firstFreeSlot(request, eventType.id);
  await chooseSlot(page, nextSlot);
  await expect(page.getByRole('textbox', { name: 'Имя' })).toHaveValue(guest.name);
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(guest.email);
  await expect(page.getByRole('textbox', { name: 'Заметка' })).toHaveValue(guest.note);
});
