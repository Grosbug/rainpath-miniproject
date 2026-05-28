import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common'
import { ZodSchema } from 'zod'

export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T | unknown {
    if (metadata.type !== 'body') return value
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException('Validation failed', { cause: result.error })
    }
    return result.data
  }
}
