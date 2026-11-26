import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Отдельный порт, а не dev-бэкенд :3000: тесты идут на свежем сервере со статикой и без демо-данных
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  // Сценарии делят один сервер и одно расписание владельца: бронирование любого типа занимает
  // время для всех типов, поэтому параллельные сценарии отбирали бы друг у друга слоты
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Фронтенд собирает задача `mise run e2e` до запуска: со `wildcard: false` сервер
    // регистрирует маршруты только на файлы, которые лежат в папке при старте
    command: 'node src/server.ts',
    cwd: fileURLToPath(new URL('../backend', import.meta.url)),
    url: `${BASE_URL}/api/health`,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DEMO_DATA: 'false',
      STATIC_DIR: fileURLToPath(new URL('../frontend/dist', import.meta.url)),
    },
    // Всегда свой сервер: данные в памяти, и чужой процесс на порту дал бы чужое состояние
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
