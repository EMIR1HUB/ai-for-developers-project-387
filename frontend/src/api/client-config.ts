import type { CreateClientConfig } from './generated/client.gen';

// fetch в Node (тесты) не принимает относительные URL, поэтому база задаётся явно:
// API всегда отдаётся с того же origin, что и фронтенд (в dev через прокси Vite)
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: window.location.origin,
});
