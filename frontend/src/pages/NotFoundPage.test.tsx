import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp.tsx';

describe('Страница 404', () => {
  it('should show not found when url is unknown', () => {
    // when
    renderApp('/no-such-page');

    // then
    expect(
      screen.getByRole('heading', { level: 1, name: 'Страница не найдена' }),
    ).toBeInTheDocument();
  });

  it('should return to home page when guest clicks link on not found page', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/no-such-page');

    // when
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'На главную' }));

    // then
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
  });
});
