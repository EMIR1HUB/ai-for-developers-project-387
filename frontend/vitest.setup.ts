import '@testing-library/jest-dom/vitest';
import { notifications } from '@mantine/notifications';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/test/mockApi.ts';

// Запрос без обработчика — ошибка теста: сеть в тестах описана явно
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  // Уведомления Mantine живут в глобальном хранилище и иначе перешли бы в следующий тест
  notifications.clean();
});
afterAll(() => server.close());

const noop = () => {};

// jsdom не реализует matchMedia, а MantineProvider читает через него цветовую схему
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false,
  }),
});

// jsdom не реализует ResizeObserver, а ScrollArea Mantine следит через него за размерами
window.ResizeObserver = class {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
};
