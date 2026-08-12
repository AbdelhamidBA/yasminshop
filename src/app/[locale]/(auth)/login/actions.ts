'use server';

import {AuthError} from 'next-auth';
import {headers} from 'next/headers';
import {signIn} from '@/auth';
import {prisma} from '@/lib/db';
import {RATE_LIMITS, clientIpFromHeaders, enforceRateLimit} from '@/lib/rate-limit';

// Where a successful sign-in lands: staff go straight to the dashboard, every
// other account to the storefront. next-auth needs `redirectTo` at call time,
// before it has authenticated anyone, so the role is read up front by email —
// the same unnormalized lookup authorize() performs. This leaks nothing: the
// form's answer to a wrong password is identical either way, and the redirect
// only ever happens once signIn has actually succeeded. The path stays
// locale-less on purpose; the proxy prefixes it (/admin → /fr/admin) exactly
// as it already does for '/'.
async function destinationFor(email: FormDataEntryValue | null): Promise<string> {
  // Scalar guard before the query (project idiom): only a plausible email
  // string ever reaches Prisma.
  if (typeof email !== 'string' || email.length === 0 || email.length > 320) return '/';
  const user = await prisma.user.findUnique({where: {email}, select: {role: true}});
  return user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN' ? '/admin' : '/';
}

// Returned error strings: 'invalid' → bad credentials (the sole message the form
// shows for any auth failure, so it is not an account-existence oracle);
// 'rateLimited' → too many attempts from this IP (distinct copy, honest UX).
export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  // Rate-limit the credentials sign-in by client IP before touching next-auth —
  // login is an unauthenticated public write and the prime brute-force target.
  const ip = clientIpFromHeaders(await headers());
  if (!enforceRateLimit(`login:${ip}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs).allowed) {
    return 'rateLimited';
  }

  const email = formData.get('email');
  try {
    await signIn('credentials', {
      email,
      password: formData.get('password'),
      redirectTo: await destinationFor(email)
    });
  } catch (error) {
    if (error instanceof AuthError) return 'invalid';
    throw error; // NEXT_REDIRECT on success must propagate
  }
}
