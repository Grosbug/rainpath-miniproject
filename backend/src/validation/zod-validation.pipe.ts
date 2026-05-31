import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates `@Body()` or `@Query()` payloads against a Zod schema. Errors are
 * raised as `BadRequestException(cause: ZodError)` so the global
 * `ZodExceptionFilter` can reshape them into the standard 422 envelope.
 *
 * Param-level (`@Param()`) and custom decorators are passed through unchanged —
 * those are validated case-by-case inside controllers when needed.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T | unknown {
    if (metadata.type !== 'body' && metadata.type !== 'query') return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException('Validation failed', {
        cause: result.error,
      });
    }
    return result.data;
  }
}
