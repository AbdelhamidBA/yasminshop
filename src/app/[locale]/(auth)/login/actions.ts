'use server';

import {AuthError} from 'next-auth';
import {headers} from 'next/headers';
import {signIn} from '@/auth';
import {RATE_LIMITS, clientIpFromHeaders, enforceRateLimit} from '@/lib/rate-limit';

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

  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/'
    });
  } catch (error) {
    if (error instanceof AuthError) return 'invalid';
    throw error; // NEXT_REDIRECT on success must propagate
  }
}
