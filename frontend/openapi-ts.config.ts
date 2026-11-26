import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../api/openapi.yaml',
  output: 'src/api/generated',
  plugins: [
    { name: '@hey-api/client-fetch', runtimeConfigPath: './src/api/client-config.ts' },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
