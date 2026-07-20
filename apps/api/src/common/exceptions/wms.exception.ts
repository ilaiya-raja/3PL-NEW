import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@wms/types';

export class WmsException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ errorCode, message, details }, statusCode);
  }
}
