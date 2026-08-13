import {Prisma} from '@prisma/client';

// Reading a unique-constraint violation is not as simple as it looks: the
// shape of P2002's metadata depends on how Prisma talks to the database.
//
//   classic engine  -> meta.target = ['reference']  (or a constraint string)
//   driver adapter  -> meta.driverAdapterError.cause.constraint.fields = [...]
//
// This project uses @prisma/adapter-pg, so meta.target is UNDEFINED. Code that
// only looked at meta.target silently decided "not a unique violation" and
// rethrew — turning "that reference already exists" into a 500 error page.
// Both shapes are handled here, with the constraint NAME as a last resort
// (Postgres names them "Product_reference_key").

type DriverAdapterMeta = {
  driverAdapterError?: {
    cause?: {
      constraint?: {fields?: unknown} | string;
    };
  };
  target?: unknown;
};

/** The column names a P2002 fired on, or null when it is not a P2002. */
export function uniqueViolationFields(error: unknown): string[] | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  const meta = (error.meta ?? {}) as DriverAdapterMeta;

  const constraint = meta.driverAdapterError?.cause?.constraint;
  if (constraint && typeof constraint === 'object' && Array.isArray(constraint.fields)) {
    return constraint.fields.filter((field): field is string => typeof field === 'string');
  }
  // Constraint reported as a bare name, e.g. "Product_reference_key".
  if (typeof constraint === 'string') return [constraint];

  const target = meta.target;
  if (Array.isArray(target)) {
    return target.filter((field): field is string => typeof field === 'string');
  }
  if (typeof target === 'string') return [target];

  return [];
}

/**
 * True when a unique constraint on `column` was violated. Matches a bare
 * constraint name too, so "Product_reference_key" counts as `reference`.
 */
export function isUniqueViolationOn(error: unknown, column: string): boolean {
  const fields = uniqueViolationFields(error);
  if (fields === null) return false;
  return fields.some((field) => field === column || field.includes(column));
}
