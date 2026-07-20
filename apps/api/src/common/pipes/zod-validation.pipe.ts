import {
  ArgumentMetadata,
  BadRequestException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { ErrorCodes } from '@wms/types';
import { WmsException } from '../exceptions/wms.exception';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');

      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        message || 'Validation failed',
        HttpStatus.BAD_REQUEST,
        { issues: result.error.issues },
      );
    }

    return result.data;
  }
}

export function createZodValidationPipe(
  schema: ZodSchema,
): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}

export class ZodBodyValidationPipe extends ZodValidationPipe {
  constructor(schema: ZodSchema) {
    super(schema);
  }

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body') {
      return value;
    }

    try {
      return super.transform(value, metadata);
    } catch (error) {
      if (error instanceof WmsException) {
        throw error;
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
