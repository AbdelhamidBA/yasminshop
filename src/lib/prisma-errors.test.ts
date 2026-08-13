import {Prisma} from '@prisma/client';
import {describe, expect, it} from 'vitest';
import {isUniqueViolationOn, uniqueViolationFields} from './prisma-errors';

function p2002(meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta
  });
}

describe('uniqueViolationFields', () => {
  // The shape this project actually produces: @prisma/adapter-pg reports the
  // constraint under driverAdapterError and leaves meta.target undefined.
  it('reads the driver-adapter shape', () => {
    const error = p2002({
      modelName: 'Product',
      driverAdapterError: {
        cause: {kind: 'UniqueConstraintViolation', constraint: {fields: ['reference']}}
      }
    });
    expect(uniqueViolationFields(error)).toEqual(['reference']);
    expect(isUniqueViolationOn(error, 'reference')).toBe(true);
    expect(isUniqueViolationOn(error, 'slug')).toBe(false);
  });

  it('reads the classic engine shape', () => {
    const error = p2002({target: ['slug']});
    expect(isUniqueViolationOn(error, 'slug')).toBe(true);
    expect(isUniqueViolationOn(error, 'reference')).toBe(false);
  });

  it('accepts a bare constraint name', () => {
    const named = p2002({driverAdapterError: {cause: {constraint: 'Product_reference_key'}}});
    expect(isUniqueViolationOn(named, 'reference')).toBe(true);

    const targetString = p2002({target: 'Product_slug_key'});
    expect(isUniqueViolationOn(targetString, 'slug')).toBe(true);
  });

  it('ignores errors that are not P2002', () => {
    const other = new Prisma.PrismaClientKnownRequestError('nope', {
      code: 'P2025',
      clientVersion: 'test'
    });
    expect(uniqueViolationFields(other)).toBeNull();
    expect(isUniqueViolationOn(other, 'reference')).toBe(false);
    expect(isUniqueViolationOn(new Error('plain'), 'reference')).toBe(false);
  });

  it('survives a P2002 with no usable metadata', () => {
    const bare = p2002({});
    expect(uniqueViolationFields(bare)).toEqual([]);
    expect(isUniqueViolationOn(bare, 'reference')).toBe(false);
  });
});
