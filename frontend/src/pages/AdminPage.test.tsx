import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Booking, NewEventType } from '../api/generated/types.gen';
import { mockApi, mockApiNetworkError, server } from '../test/mockApi.ts';
import { renderApp } from '../test/renderApp.tsx';

const INTRO = {
  id: 'intro-15',
  title: 'Встреча 15 минут',
  description: 'Короткое знакомство',
  durationMinutes: 15,
};
const CALL = {
  id: 'call-30',
  title: 'Встреча 30 минут',
  description: 'Подробный разговор',
  durationMinutes: 30,
};

function eventTypesSection() {
  return screen.getByRole('region', { name: 'Типы встреч' });
}

// Поле формы по подписи; звёздочка обязательного поля скрыта от вспомогательных технологий
function field(label: 'Идентификатор' | 'Название' | 'Описание' | 'Длительность') {
  return screen.getByRole(label === 'Длительность' ? 'combobox' : 'textbox', { name: label });
}

async function fillEventTypeForm(
  user: ReturnType<typeof userEvent.setup>,
  { id, title, description, durationLabel }: Record<string, string>,
) {
  await user.type(field('Идентификатор'), id);
  await user.type(field('Название'), title);
  if (description) {
    await user.type(field('Описание'), description);
  }
  await user.selectOptions(field('Длительность'), durationLabel);
}

describe('Админка: типы встреч', () => {
  it('should create event type, notify and refresh the list when form is valid', async () => {
    // given
    server.use(mockApi('eventTypesList', 200, [INTRO]));
    const user = userEvent.setup();
    renderApp('/admin');
    expect(
      await within(eventTypesSection()).findByRole('heading', { name: 'Встреча 15 минут' }),
    ).toBeInTheDocument();
    await fillEventTypeForm(user, {
      id: 'call-30',
      title: 'Встреча 30 минут',
      description: 'Подробный разговор',
      durationLabel: '30 мин',
    });
    const sent: NewEventType[] = [];
    server.use(
      mockApi('eventTypesCreate', 201, CALL, (body) => sent.push(body)),
      mockApi('eventTypesList', 200, [INTRO, CALL]),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }));

    // then
    expect(await screen.findByText('Тип встречи создан')).toBeInTheDocument();
    expect(sent).toEqual([
      {
        id: 'call-30',
        title: 'Встреча 30 минут',
        description: 'Подробный разговор',
        durationMinutes: 30,
      },
    ]);
    const items = await within(eventTypesSection()).findAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'Встреча 15 минут',
      'Встреча 30 минут',
    ]);
    expect(within(items[1]).getByText('/book/call-30')).toBeInTheDocument();
    expect(field('Идентификатор')).toHaveValue('');
  });

  it('should show conflict message under id field when id is taken', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/admin');
    await fillEventTypeForm(user, {
      id: 'intro-15',
      title: 'Ещё одна встреча',
      description: '',
      durationLabel: '15 мин',
    });
    server.use(
      mockApi('eventTypesCreate', 409, {
        code: 'EVENT_TYPE_ID_TAKEN',
        message: 'Идентификатор уже занят. Выберите другой',
      }),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }));

    // then
    const idInput = field('Идентификатор');
    await waitFor(() => expect(idInput).toHaveAttribute('aria-invalid', 'true'));
    expect(idInput).toHaveAccessibleDescription(
      expect.stringContaining('Идентификатор уже занят. Выберите другой'),
    );
    expect(idInput).toHaveValue('intro-15');
    expect(screen.queryByText('Тип встречи создан')).not.toBeInTheDocument();
  });

  it('should show validation messages under each field when server rejects fields', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/admin');
    await fillEventTypeForm(user, {
      id: 'Intro',
      title: ' ',
      description: 'Описание',
      durationLabel: '15 мин',
    });
    server.use(
      mockApi('eventTypesCreate', 422, {
        code: 'VALIDATION_ERROR',
        message: 'Поля заполнены неверно',
        fields: [
          { field: 'id', message: 'Только строчные латинские буквы, цифры и дефис' },
          { field: 'title', message: 'Обязательное поле' },
          { field: 'description', message: 'Не длиннее 500 символов' },
          { field: 'durationMinutes', message: 'От 15 до 240 минут с шагом 15' },
        ],
      }),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }));

    // then
    await waitFor(() =>
      expect(field('Идентификатор')).toHaveAccessibleDescription(
        expect.stringContaining('Только строчные латинские буквы, цифры и дефис'),
      ),
    );
    expect(field('Название')).toHaveAccessibleDescription('Обязательное поле');
    expect(field('Описание')).toHaveAccessibleDescription('Не длиннее 500 символов');
    expect(field('Длительность')).toHaveAccessibleDescription('От 15 до 240 минут с шагом 15');
  });

  it('should show connection error above the form when creation responds with 500', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/admin');
    await fillEventTypeForm(user, {
      id: 'call-30',
      title: 'Встреча 30 минут',
      description: '',
      durationLabel: '30 мин',
    });
    server.use(
      mockApi('eventTypesCreate', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }));

    // then
    const form = screen.getByRole('form', { name: 'Новый тип встречи' });
    expect(await within(form).findByText('Не удалось связаться с сервером')).toBeInTheDocument();
    expect(field('Идентификатор')).toHaveValue('call-30');
  });
});

// Сервер отдаёт время в поясе владельца, а тесты идут в America/Los_Angeles: 09:00 по Алматы
// 25 ноября там ещё 24 ноября, поэтому пересчёт в пояс браузера сдвинул бы и день, и часы
const UPCOMING: Booking[] = [
  {
    id: '4f6c1c1e-1b7e-4d0a-9a51-2f0d3b8f7a10',
    eventType: { id: 'call-30', title: 'Встреча 30 минут', durationMinutes: 30 },
    start: '2026-11-24T17:30:00+05:00',
    end: '2026-11-24T18:00:00+05:00',
    guestName: 'Анна Смирнова',
    guestEmail: 'anna@example.com',
    createdAt: '2026-11-20T12:00:00+05:00',
  },
  {
    id: '9a3e2d4b-6c1f-4e8a-b2d7-5f0e1a9c3b21',
    eventType: { id: 'intro-15', title: 'Встреча 15 минут', durationMinutes: 15 },
    start: '2026-11-25T09:00:00+05:00',
    end: '2026-11-25T09:15:00+05:00',
    guestName: 'Иван Петров',
    guestEmail: 'ivan@example.com',
    note: 'Обсудить проект',
    createdAt: '2026-11-21T08:00:00+05:00',
  },
];

function upcomingSection() {
  return screen.getByRole('region', { name: 'Предстоящие бронирования' });
}

describe('Админка: предстоящие бронирования', () => {
  it('should show bookings table in server order with owner time zone when there are bookings', async () => {
    // given
    server.use(
      mockApi('bookingsList', 200, UPCOMING),
      mockApi('ownerGet', 200, {
        name: 'Эмир',
        subtitle: 'Разработчик',
        timeZone: 'Asia/Almaty',
      }),
    );

    // when
    renderApp('/admin');

    // then
    const table = await within(upcomingSection()).findByRole('table');
    const rows = within(table)
      .getAllByRole('row')
      .map((row) =>
        [...within(row).queryAllByRole('columnheader'), ...within(row).queryAllByRole('cell')].map(
          (cell) => cell.textContent,
        ),
      );
    expect(rows).toEqual([
      ['Дата и время', 'Тип встречи', 'Имя', 'Email', 'Заметка'],
      [
        'вторник, 24 ноября, 17:30–18:00',
        'Встреча 30 минут',
        'Анна Смирнова',
        'anna@example.com',
        '—',
      ],
      [
        'среда, 25 ноября, 09:00–09:15',
        'Встреча 15 минут',
        'Иван Петров',
        'ivan@example.com',
        'Обсудить проект',
      ],
    ]);
    expect(
      within(upcomingSection()).getByText('Время указано по Алматы (UTC+5)'),
    ).toBeInTheDocument();
  });

  it('should show empty state when there are no upcoming bookings', async () => {
    // given
    server.use(mockApi('bookingsList', 200, []));

    // when
    renderApp('/admin');

    // then
    expect(
      await within(upcomingSection()).findByText('Предстоящих бронирований нет'),
    ).toBeInTheDocument();
    expect(within(upcomingSection()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('should show connection error with retry when server is unreachable', async () => {
    // given
    server.use(mockApiNetworkError('bookingsList'));
    const user = userEvent.setup();
    renderApp('/admin');
    const alert = await within(upcomingSection()).findByRole('alert');
    expect(within(alert).getByText('Не удалось связаться с сервером')).toBeInTheDocument();

    // when
    server.use(mockApi('bookingsList', 200, UPCOMING));
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }));

    // then
    const table = await within(upcomingSection()).findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(upcomingSection()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show connection error with retry when upcoming bookings respond with 500', async () => {
    // given
    server.use(
      mockApi('bookingsList', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
    );

    // when
    renderApp('/admin');

    // then
    const alert = await within(upcomingSection()).findByRole('alert');
    expect(within(alert).getByText('Не удалось связаться с сервером')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('should show connection error with retry when event types respond with 500', async () => {
    // given
    server.use(
      mockApi('eventTypesList', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
    );

    // when
    renderApp('/admin');

    // then
    const alert = await within(eventTypesSection()).findByRole('alert');
    expect(within(alert).getByText('Не удалось связаться с сервером')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
