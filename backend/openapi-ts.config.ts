import { defineConfig } from '@hey-api/openapi-ts';

// Бэкенду нужны только типы контракта: маршруты реализуются вручную и проверяются тестами
export default defineConfig({
  input: '../api/openapi.yaml',
  output: {
    path: 'src/generated',
    // Node запускает .ts напрямую (type stripping), поэтому импорты нужны с расширением
    module: { extension: '.ts' },
  },
  plugins: ['@hey-api/typescript'],
});
