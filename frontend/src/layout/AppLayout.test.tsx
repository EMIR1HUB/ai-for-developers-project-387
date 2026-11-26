import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp.tsx';

function header() {
  return within(screen.getByRole('banner'));
}

describe('Шапка', () => {
  it('should open admin when owner clicks admin link in header', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/');

    // when
    await user.click(header().getByRole('link', { name: 'Админка' }));

    // then
    expect(await screen.findByRole('heading', { level: 1, name: 'Админка' })).toBeInTheDocument();
  });

  it('should open event type catalog when guest clicks book link in header', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/admin');

    // when
    await user.click(header().getByRole('link', { name: 'Записаться' }));

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Выберите тип встречи' }),
    ).toBeInTheDocument();
  });

  it('should return to home page when guest clicks logo', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/book');

    // when
    await user.click(header().getByRole('link', { name: 'Calendar' }));

    // then
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
  });
});
