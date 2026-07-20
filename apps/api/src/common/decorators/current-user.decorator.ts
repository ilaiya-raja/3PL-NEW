import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { RequestUser } from '../types/request.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!request.user) {
      throw new Error('Authenticated user not found on request');
    }
    return request.user;
  },
);
