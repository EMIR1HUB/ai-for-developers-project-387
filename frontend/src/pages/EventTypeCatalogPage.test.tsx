import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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

const OWNER = {
  name: 'Алия Нурланова',
  subtitle: 'Продуктовый дизайнер',
  timeZone: 'Asia/Almaty',
};

describe('Каталог типов встреч', () => {
  it('should show owner card with avatar, name and subtitle when catalog is opened', async () => {
    // given
    server.use(mockApi('ownerGet', 200, OWNER), mockApi('eventTypesList', 200, [INTRO]));

    // when
    renderApp('/book');

    // then
    const ownerCard = await screen.findByRole('region', { name: 'Профиль владельца' });
    expect(within(ownerCard).getByRole('img', { name: 'Алия Нурланова' })).toBeInTheDocument();
    expect(within(ownerCard).getByText('Алия Нурланова')).toBeInTheDocument();
    expect(within(ownerCard).getByText('Продуктовый дизайнер')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Выберите тип встречи' }),
    ).toBeInTheDocument();
  });

  it('should show empty state when owner has not created any event type', async () => {
    // given
    server.use(mockApi('eventTypesList', 200, []));

    // when
    renderApp('/book');

    // then
    expect(
      await screen.findByText('Владелец пока не создал ни одного типа встречи'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('should show owner error and reload profile on retry when profile loading fails', async () => {
    // given
    server.use(
      mockApi('ownerGet', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
    );
    const user = userEvent.setup();
    renderApp('/book');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Не удалось загрузить профиль владельца')).toBeInTheDocument();

    // when
    server.use(mockApi('ownerGet', 200, OWNER));
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }));

    // then
    const ownerCard = await screen.findByRole('region', { name: 'Профиль владельца' });
    expect(within(ownerCard).getByText('Алия Нурланова')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show event type cards in server order when catalog is opened', async () => {
    // given
    server.use(mockApi('eventTypesList', 200, [INTRO, CALL]));

    // when
    renderApp('/book');

    // then
    const [first, second] = await screen.findAllByRole('article');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(within(first).getByRole('heading', { name: 'Встреча 15 минут' })).toBeInTheDocument();
    expect(within(first).getByText('Короткое знакомство')).toBeInTheDocument();
    expect(within(first).getByText('15 мин')).toBeInTheDocument();
    expect(within(second).getByRole('heading', { name: 'Встреча 30 минут' })).toBeInTheDocument();
    expect(within(second).getByText('Подробный разговор')).toBeInTheDocument();
    expect(within(second).getByText('30 мин')).toBeInTheDocument();
  });

  it('should open booking page of event type when its card is clicked', async () => {
    // given
    server.use(
      mockApi('eventTypesList', 200, [INTRO, CALL]),
      mockApi('eventTypesGet', 200, CALL),
      mockApi('eventTypesListSlots', 200, []),
    );
    const user = userEvent.setup();
    renderApp('/book');
    const [, second] = await screen.findAllByRole('article');

    // when
    await user.click(within(second).getByRole('link'));

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Встреча 30 минут' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Выберите тип встречи' })).not.toBeInTheDocument();
  });

  it('should show skeleton until event types arrive when catalog is opened', async () => {
    // given
    server.use(mockApi('eventTypesList', 200, [INTRO]));

    // when
    renderApp('/book');

    // then
    expect(screen.getByRole('status', { name: 'Загрузка типов встреч' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Встреча 15 минут' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Загрузка типов встреч' })).not.toBeInTheDocument();
  });

  it('should show connection error and reload on retry when server responds with 500', async () => {
    // given
    server.use(
      mockApi('eventTypesList', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
    );
    const user = userEvent.setup();
    renderApp('/book');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Не удалось загрузить типы встреч')).toBeInTheDocument();
    expect(within(alert).getByText('Не удалось связаться с сервером')).toBeInTheDocument();
    expect(
      within(alert).queryByText('Внутренняя ошибка сервера. Попробуйте позже'),
    ).not.toBeInTheDocument();

    // when
    server.use(mockApi('eventTypesList', 200, [CALL]));
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }));

    // then
    expect(await screen.findByRole('heading', { name: 'Встреча 30 минут' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show connection error when server is unreachable', async () => {
    // given
    server.use(mockApiNetworkError('eventTypesList'));

    // when
    renderApp('/book');

    // then
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Не удалось связаться с сервером')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
