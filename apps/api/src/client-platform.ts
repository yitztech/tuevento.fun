import { clientPlatformSchema } from '@tuevento/contracts';
import type { FastifyRequest } from 'fastify';
export const clientPlatform = (req: FastifyRequest) => clientPlatformSchema.safeParse(req.headers['x-client-platform']).data || 'web';
