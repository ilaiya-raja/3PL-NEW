import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCodes, type ApiErrorResponse, type ErrorCode } from '@wms/types';
import { WmsException } from '../exceptions/wms.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: ErrorCode = ErrorCodes.SYS_INTERNAL;
    let message = 'Internal server error';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof WmsException) {
      statusCode = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        message =
          typeof body.message === 'string'
            ? body.message
            : Array.isArray(body.message)
              ? body.message.join(', ')
              : message;
        if (typeof body.errorCode === 'string') {
          errorCode = body.errorCode as ErrorCode;
        }
        if (typeof body.details === 'object' && body.details !== null) {
          details = body.details as Record<string, unknown>;
        }
      }

      if (statusCode === HttpStatus.UNAUTHORIZED) {
        errorCode = ErrorCodes.AUTH_UNAUTHORIZED;
      } else if (statusCode === HttpStatus.FORBIDDEN) {
        errorCode = ErrorCodes.AUTH_FORBIDDEN;
      } else if (statusCode === HttpStatus.NOT_FOUND) {
        errorCode = ErrorCodes.SYS_NOT_FOUND;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Unknown exception', String(exception));
    }

    const payload: ApiErrorResponse = {
      statusCode,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details ? { details } : {}),
    };

    void response.status(statusCode).send(payload);
  }
}
