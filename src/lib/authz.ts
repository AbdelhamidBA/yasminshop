import type {Session} from 'next-auth';

export type Role = 'ADMIN' | 'SUB_ADMIN' | 'CLIENT';

export class AuthzError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthzError';
  }
}

export function assertRole(
  session: Session | null,
  ...allowed: Role[]
): asserts session is Session {
  if (!session || !allowed.includes(session.user.role)) {
    throw new AuthzError();
  }
}
