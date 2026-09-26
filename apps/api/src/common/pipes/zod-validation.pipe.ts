import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validate & parse a request payload against a Zod schema. Unknown fields are rejected by using
 * `.strict()` schemas at the call site (OWASP A03 / ASVS 5.1). On failure a 400 with field-level
 * messages is returned — safe to show, no internals leaked.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: result.error.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`),
        error: 'ValidationError',
      });
    }
    return result.data;
  }
}
