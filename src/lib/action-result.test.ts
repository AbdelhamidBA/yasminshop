import {describe, expect, test} from 'vitest';
import {z} from 'zod';
import {failure, fieldErrorsFromZod, success} from './action-result';

describe('fieldErrorsFromZod', () => {
  test('maps the first message per field path', () => {
    const schema = z.object({name: z.string().min(2), qty: z.number().int().min(0)});
    const parsed = schema.safeParse({name: '', qty: -1});
    if (parsed.success) throw new Error('expected failure');
    const errors = fieldErrorsFromZod(parsed.error);
    expect(Object.keys(errors).sort()).toEqual(['name', 'qty']);
    expect(typeof errors.name).toBe('string');
  });

  test('joins nested paths with dots', () => {
    const schema = z.object({social: z.object({facebook: z.string().min(1)})});
    const parsed = schema.safeParse({social: {facebook: ''}});
    if (parsed.success) throw new Error('expected failure');
    expect(Object.keys(fieldErrorsFromZod(parsed.error))).toEqual(['social.facebook']);
  });

  test('uses "_" for issues without a path', () => {
    const schema = z.string().refine(() => false, {message: 'nope'});
    const parsed = schema.safeParse('x');
    if (parsed.success) throw new Error('expected failure');
    expect(fieldErrorsFromZod(parsed.error)).toEqual({_: 'nope'});
  });
});

describe('result constructors', () => {
  test('success wraps data', () => {
    expect(success(42)).toEqual({ok: true, data: 42});
  });

  test('failure carries error and fieldErrors', () => {
    expect(failure('invalid', {a: 'b'})).toEqual({ok: false, error: 'invalid', fieldErrors: {a: 'b'}});
  });
});
