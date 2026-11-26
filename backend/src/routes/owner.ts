import type { FastifyInstance } from 'fastify';
import type { OwnerGetResponse } from '../generated/types.gen.ts';
import { OWNER_PROFILE } from '../ownerProfile.ts';

export function registerOwnerRoutes(app: FastifyInstance): void {
  app.get('/api/owner', async (): Promise<OwnerGetResponse> => OWNER_PROFILE);
}
