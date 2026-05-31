import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { z, ZodError } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const Schema = z.object({
  name: z.string().min(1),
  age: z.number().int().nonnegative(),
});

describe('ZodValidationPipe', () => {
  const meta: ArgumentMetadata = {
    type: 'body',
    metatype: undefined,
    data: undefined,
  };

  it('returns the parsed value when input is valid', () => {
    const pipe = new ZodValidationPipe(Schema);
    expect(pipe.transform({ name: 'Alice', age: 30 }, meta)).toEqual({
      name: 'Alice',
      age: 30,
    });
  });

  it('throws a ZodError-bearing BadRequestException for invalid input', () => {
    const pipe = new ZodValidationPipe(Schema);
    let thrown: unknown;
    try {
      pipe.transform({ name: '', age: -1 }, meta);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BadRequestException);
    const cause = (thrown as BadRequestException).cause;
    expect(cause).toBeInstanceOf(ZodError);
    expect((cause as ZodError).issues.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores params/query (only validates body)', () => {
    const pipe = new ZodValidationPipe(Schema);
    const paramMeta: ArgumentMetadata = {
      type: 'param',
      metatype: undefined,
      data: 'id',
    };
    expect(pipe.transform('whatever', paramMeta)).toBe('whatever');
  });
});
