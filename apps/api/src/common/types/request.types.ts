import type { JwtPayload } from '@wms/types';

export type RequestUser = JwtPayload;

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
    clientId?: string;
  }
}
