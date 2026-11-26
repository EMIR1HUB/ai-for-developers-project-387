import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { NewBooking } from '../../api/generated/types.gen';
import { mockApi, mockApiNetworkError, server } from '../../test/mockApi.ts';
import { renderApp } from '../../test/renderApp.tsx';

const OWNER = {
  name: 'Алия Нурланова',
  subtitle: 'Продуктовый дизайнер',
  timeZone: 'Asia/Almaty',
};

const CALL = {
  id: 'call-30',
  title: 'Встреча 30 минут',
  description: 'Подробный разговор о проекте',
  durationMinutes: 30,
};

function slot(start: string, end: string, available: boolean) {
  return { start: `${start}:00+05:00`, end: `${end}:00+05:00`, available };
}

// Окно записи с 24 ноября по 1 декабря: в первый день свободных слотов нет
const SLOTS = [
  slot('2026-11-24T17:00', '2026-11-24T17:30', false),
  slot('2026-11-24T17:30', '2026-11-24T18:00', false),
  slot('2026-11-25T09:00', '2026-11-25T09:30', true),
  slot('2026-11-25T09:30', '2026-11-25T10:00', false),
  slot('2026-11-25T10:00', '2026-11-25T10:30', true),
  slot('2026-11-30T09:00', '2026-11-30T09:30', true),
  slot('2026-12-01T09:00', '2026-12-01T09:30', true),
];

function mockBookingPage() {
  server.use(
    mockApi('ownerGet', 200, OWNER),
    mockApi('eventTypesGet', 200, CALL),
    mockApi('eventTypesListSlots', 200, SLOTS),
  );
}

function slotsColumn() {
  return screen.getByRole('region', { name: 'Слоты дня' });
}

function summaryCard() {
  return screen.getByRole('region', { name: 'Тип встречи' });
}

describe('Страница бронирования: выбор времени', () => {
  it('should show event type card with owner, duration and description when page is opened', async () => {
    // given
    mockBookingPage();

    // when
    renderApp('/book/call-30');

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Встреча 30 минут' }),
    ).toBeInTheDocument();
    const summary = summaryCard();
    expect(within(summary).getByText('Алия Нурланова')).toBeInTheDocument();
    expect(within(summary).getByText('30 мин')).toBeInTheDocument();
    expect(within(summary).getByText('Подробный разговор о проекте')).toBeInTheDocument();
    expect(screen.getByText('Время указано по Алматы (UTC+5)')).toBeInTheDocument();
  });

  it('should select first day with free slots by default when first window day is fully taken', async () => {
    // given
    mockBookingPage();

    // when
    renderApp('/book/call-30');

    // then
    const day = await screen.findByRole('button', { name: '25 ноября, свободных слотов: 2' });
    expect(day).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(slotsColumn()).getByRole('heading', { name: 'среда, 25 ноября' }),
    ).toBeInTheDocument();
    expect(within(slotsColumn()).getAllByRole('button')).toHaveLength(3);
  });

  it('should show taken slots as disabled and free slots as enabled when day is selected', async () => {
    // given
    mockBookingPage();

    // when
    renderApp('/book/call-30');

    // then
    const column = await screen.findByRole('region', { name: 'Слоты дня' });
    expect(within(column).getByRole('button', { name: '09:00–09:30 Свободно' })).toBeEnabled();
    expect(within(column).getByRole('button', { name: '09:30–10:00 Занято' })).toBeDisabled();
    expect(within(column).getByRole('button', { name: '10:00–10:30 Свободно' })).toBeEnabled();
  });

  it('should show free slot counts and disable days outside window when calendar is shown', async () => {
    // given
    mockBookingPage();

    // when
    renderApp('/book/call-30');

    // then
    expect(
      await screen.findByRole('button', { name: '24 ноября, свободных слотов: 0' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: '30 ноября, свободных слотов: 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '23 ноября' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '27 ноября' })).toBeDisabled();
  });

  it('should show slots of chosen day when another day is clicked in calendar', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');

    // when
    await user.click(await screen.findByRole('button', { name: '30 ноября, свободных слотов: 1' }));

    // then
    expect(
      within(slotsColumn()).getByRole('heading', { name: 'понедельник, 30 ноября' }),
    ).toBeInTheDocument();
    expect(within(slotsColumn()).getAllByRole('button')).toHaveLength(1);
    expect(
      within(slotsColumn()).getByRole('button', { name: '09:00–09:30 Свободно' }),
    ).toBeInTheDocument();
  });

  it('should show december days when next month arrow is clicked and window spans two months', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await screen.findByRole('button', { name: '25 ноября, свободных слотов: 2' });
    expect(
      screen.queryByRole('button', { name: '1 декабря, свободных слотов: 1' }),
    ).not.toBeInTheDocument();

    // when
    await user.click(screen.getByRole('button', { name: 'Следующий месяц' }));

    // then
    expect(screen.getByRole('button', { name: '1 декабря, свободных слотов: 1' })).toBeEnabled();
  });

  it('should show chosen date and time in card and enable continue when free slot is chosen', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');
    const column = await screen.findByRole('region', { name: 'Слоты дня' });
    const continueButton = screen.getByRole('button', { name: 'Продолжить' });
    expect(continueButton).toBeDisabled();

    // when
    await user.click(within(column).getByRole('button', { name: '10:00–10:30 Свободно' }));

    // then
    expect(within(column).getByRole('button', { name: '10:00–10:30 Свободно' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(summaryCard()).getByText('среда, 25 ноября')).toBeInTheDocument();
    expect(within(summaryCard()).getByText('10:00–10:30')).toBeInTheDocument();
    expect(continueButton).toBeEnabled();
  });

  it('should lead back to catalog when back is clicked', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');

    // when
    await user.click(await screen.findByRole('link', { name: 'Назад' }));

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Выберите тип встречи' }),
    ).toBeInTheDocument();
  });

  it('should show not found message with link to catalog when event type is unknown', async () => {
    // given
    const notFound = { code: 'EVENT_TYPE_NOT_FOUND', message: 'Тип встречи не найден' } as const;
    server.use(
      mockApi('ownerGet', 200, OWNER),
      mockApi('eventTypesGet', 404, notFound),
      mockApi('eventTypesListSlots', 404, notFound),
    );

    // when
    renderApp('/book/unknown-type');

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Тип встречи не найден' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'К каталогу' })).toHaveAttribute('href', '/book');
  });
});

const BOOKING = {
  id: '0b8c3c52-6a43-4c1e-a8f4-1f0f8c9b2d71',
  eventType: { id: 'call-30', title: 'Встреча 30 минут', durationMinutes: 30 },
  start: '2026-11-25T10:00:00+05:00',
  end: '2026-11-25T10:30:00+05:00',
  guestName: 'Иван Петров',
  guestEmail: 'ivan@example.com',
  note: 'Обсудить проект',
  createdAt: '2026-11-24T10:00:00+05:00',
};

const SLOT_TAKEN = {
  code: 'SLOT_TAKEN',
  message: 'Это время уже заняли. Выберите другой слот',
} as const;

function guestField(label: 'Имя' | 'Email' | 'Заметка') {
  return screen.getByRole('textbox', { name: label });
}

/** Выбрать слот 25 ноября 10:00–10:30 и перейти к форме данных гостя */
async function openGuestForm(user: UserEvent) {
  const column = await screen.findByRole('region', { name: 'Слоты дня' });
  await user.click(within(column).getByRole('button', { name: '10:00–10:30 Свободно' }));
  await user.click(screen.getByRole('button', { name: 'Продолжить' }));
}

async function fillGuestForm(user: UserEvent) {
  await user.type(guestField('Имя'), 'Иван Петров');
  await user.type(guestField('Email'), 'ivan@example.com');
  await user.type(guestField('Заметка'), 'Обсудить проект');
}

describe('Страница бронирования: данные гостя и подтверждение', () => {
  it('should send chosen slot with guest data and show confirmation when booking is created', async () => {
    // given
    mockBookingPage();
    const requests: NewBooking[] = [];
    server.use(mockApi('bookingsCreate', 201, BOOKING, (body) => requests.push(body)));
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await openGuestForm(user);
    expect(within(summaryCard()).getByText('10:00–10:30')).toBeInTheDocument();
    await fillGuestForm(user);

    // when
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    // then
    expect(
      await screen.findByRole('heading', { name: 'Бронирование создано' }),
    ).toBeInTheDocument();
    expect(requests).toEqual([
      {
        eventTypeId: 'call-30',
        start: '2026-11-25T10:00:00+05:00',
        guestName: 'Иван Петров',
        guestEmail: 'ivan@example.com',
        note: 'Обсудить проект',
      },
    ]);
    const confirmation = screen.getByRole('region', { name: 'Бронирование создано' });
    expect(within(confirmation).getByText('Встреча 30 минут')).toBeInTheDocument();
    expect(within(confirmation).getByText('среда, 25 ноября')).toBeInTheDocument();
    expect(within(confirmation).getByText('10:00–10:30 по Алматы (UTC+5)')).toBeInTheDocument();
    expect(within(confirmation).getByText('Иван Петров')).toBeInTheDocument();
    expect(within(confirmation).getByText('ivan@example.com')).toBeInTheDocument();
    expect(within(confirmation).getByText('Обсудить проект')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'К каталогу' })).toHaveAttribute('href', '/book');
  });

  it('should return to time selection with reloaded slots and kept form data when slot was taken', async () => {
    // given
    mockBookingPage();
    server.use(mockApi('bookingsCreate', 409, SLOT_TAKEN));
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await openGuestForm(user);
    await fillGuestForm(user);
    // Пока гость заполнял форму, 10:00–10:30 заняли: после конфликта сервер отдаст его занятым
    server.use(
      mockApi(
        'eventTypesListSlots',
        200,
        SLOTS.map((s) =>
          s.start === '2026-11-25T10:00:00+05:00' ? { ...s, available: false } : s,
        ),
      ),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    // then
    expect(
      await screen.findByText('Это время уже заняли. Выберите другой слот'),
    ).toBeInTheDocument();
    const column = await screen.findByRole('region', { name: 'Слоты дня' });
    expect(
      await within(column).findByRole('button', { name: '10:00–10:30 Занято' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled();

    await user.click(within(column).getByRole('button', { name: '09:00–09:30 Свободно' }));
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(guestField('Имя')).toHaveValue('Иван Петров');
    expect(guestField('Email')).toHaveValue('ivan@example.com');
    expect(guestField('Заметка')).toHaveValue('Обсудить проект');
  });

  it('should return to time selection with server reason when slot is no longer offered', async () => {
    // given
    mockBookingPage();
    server.use(
      mockApi('bookingsCreate', 422, {
        code: 'SLOT_NOT_OFFERED',
        message: 'Это время уже прошло. Выберите другой слот',
      }),
    );
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await openGuestForm(user);
    await fillGuestForm(user);

    // when
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    // then
    expect(
      await screen.findByText('Это время уже прошло. Выберите другой слот'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Слоты дня' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Забронировать' })).not.toBeInTheDocument();
  });

  it('should show server errors under fields when guest data is invalid', async () => {
    // given
    mockBookingPage();
    server.use(
      mockApi('bookingsCreate', 422, {
        code: 'VALIDATION_ERROR',
        message: 'Поля заполнены неверно',
        fields: [
          { field: 'guestName', message: 'Обязательное поле' },
          { field: 'guestEmail', message: 'Неверный формат email' },
          { field: 'note', message: 'Не длиннее 1000 символов' },
        ],
      }),
    );
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await openGuestForm(user);
    await user.type(guestField('Email'), 'ivan.example.com');

    // when
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    // then
    expect(await screen.findByText('Неверный формат email')).toBeInTheDocument();
    expect(guestField('Имя')).toHaveAccessibleDescription('Обязательное поле');
    expect(guestField('Имя')).toHaveAttribute('aria-invalid', 'true');
    expect(guestField('Email')).toHaveAccessibleDescription('Неверный формат email');
    expect(guestField('Заметка')).toHaveAccessibleDescription('Не длиннее 1000 символов');
    expect(screen.getByRole('button', { name: 'Забронировать' })).toBeInTheDocument();
  });

  it('should keep entered data when guest goes back to time selection and returns', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await openGuestForm(user);
    await fillGuestForm(user);

    // when
    await user.click(screen.getByRole('button', { name: 'Назад' }));
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));

    // then
    expect(guestField('Имя')).toHaveValue('Иван Петров');
    expect(guestField('Email')).toHaveValue('ivan@example.com');
    expect(guestField('Заметка')).toHaveValue('Обсудить проект');
    expect(within(summaryCard()).getByText('10:00–10:30')).toBeInTheDocument();
  });

  it('should offer retry and create booking on retry when server is unreachable', async () => {
    // given
    mockBookingPage();
    server.use(mockApiNetworkError('bookingsCreate'));
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await openGuestForm(user);
    await fillGuestForm(user);
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(await screen.findByText('Не удалось связаться с сервером')).toBeInTheDocument();
    server.use(mockApi('bookingsCreate', 201, BOOKING));

    // when
    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    // then
    expect(
      await screen.findByRole('heading', { name: 'Бронирование создано' }),
    ).toBeInTheDocument();
  });

  it('should show connection error with retry when server responds with 500', async () => {
    // given
    mockBookingPage();
    server.use(
      mockApi('bookingsCreate', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
    );
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await openGuestForm(user);
    await fillGuestForm(user);

    // when
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    // then
    expect(await screen.findByText('Не удалось связаться с сервером')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
    expect(
      screen.queryByText('Внутренняя ошибка сервера. Попробуйте позже'),
    ).not.toBeInTheDocument();
  });

  it('should show connection error with retry when event type loading responds with 500', async () => {
    // given
    server.use(
      mockApi('ownerGet', 200, OWNER),
      mockApi('eventTypesGet', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
      mockApi('eventTypesListSlots', 200, SLOTS),
    );

    // when
    renderApp('/book/call-30');

    // then
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Не удалось связаться с сервером')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
