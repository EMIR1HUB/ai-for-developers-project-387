import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp.tsx';

describe('Главная страница', () => {
  it('should describe the service and offer to book when opened at /', () => {
    // when
    renderApp('/');

    // then
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
    expect(
      screen.getByText('Забронируйте встречу за минуту: выберите тип встречи и удобное время.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Возможности' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Записаться' }),
    ).toBeInTheDocument();
  });

  it('should open event type catalog when guest clicks book button', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/');

    // when
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Записаться' }));

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Выберите тип встречи' }),
    ).toBeInTheDocument();
  });
});
