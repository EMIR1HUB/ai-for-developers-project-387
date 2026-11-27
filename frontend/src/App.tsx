import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from './AppRoutes.tsx';
import { cssVariablesResolver, theme } from './theme.ts';

export default function App() {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="light"
    >
      <Notifications position="top-right" />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </MantineProvider>
  );
}
