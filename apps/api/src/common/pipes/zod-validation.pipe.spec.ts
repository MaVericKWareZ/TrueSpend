import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { ZodValidationPipe, validateBody } from './zod-validation.pipe';

const bodyMeta: ArgumentMetadata = { type: 'body', metatype: undefined, data: undefined };
const queryMeta: ArgumentMetadata = { type: 'query', metatype: undefined, data: undefined };
const paramMeta: ArgumentMetadata = { type: 'param', metatype: undefined, data: undefined };

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().trim().toLowerCase().email(),
    age: z.coerce.number().int().positive(),
  });

  it('returns the parsed value on success and applies transforms', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ email: '  ALICE@x.io  ', age: '42' }, bodyMeta);
    expect(result).toEqual({ email: 'alice@x.io', age: 42 });
  });

  it('throws BadRequestException with a structured body on parse failure', () => {
    const pipe = new ZodValidationPipe(schema);
    let caught: BadRequestException | undefined;
    try {
      pipe.transform({ email: 'not-email', age: -1 }, bodyMeta);
    } catch (err) {
      caught = err as BadRequestException;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const response = caught!.getResponse() as {
      statusCode: number;
      message: string;
      errors: Array<{ path: string; message: string }>;
    };
    expect(response.statusCode).toBe(400);
    expect(response.message).toBe('Validation failed');
    expect(response.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'email' }),
        expect.objectContaining({ path: 'age' }),
      ]),
    );
  });

  it('passes through values whose metadata.type is not "body"', () => {
    const pipe = new ZodValidationPipe(schema);
    const passthroughInput = { not: 'validated' };
    expect(pipe.transform(passthroughInput, queryMeta)).toBe(passthroughInput);
    expect(pipe.transform(passthroughInput, paramMeta)).toBe(passthroughInput);
  });
});

describe('validateBody factory', () => {
  it('returns a ZodValidationPipe instance bound to the given schema', () => {
    const schema = z.object({ x: z.number() });
    const pipe = validateBody(schema);
    expect(pipe).toBeInstanceOf(ZodValidationPipe);
    expect(pipe.transform({ x: 1 }, bodyMeta)).toEqual({ x: 1 });
  });
});
