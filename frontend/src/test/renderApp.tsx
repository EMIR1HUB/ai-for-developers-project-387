import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../AppRoutes.tsx';

export function renderApp(url: string) {
  return render(
    <MantineProvider env="test">
      <Notifications />
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
      </MemoryRouter>
    </MantineProvider>,
  );
}
