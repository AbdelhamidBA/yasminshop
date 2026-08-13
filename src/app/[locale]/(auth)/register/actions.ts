'use server';

import {Prisma} from '@prisma/client';
import {AuthError} from 'next-auth';
import {headers} from 'next/headers';
import {signIn} from '@/auth';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {prisma} from '@/lib/db';
import {routing} from '@/i18n/routing';
import {hashPassword} from '@/lib/password';
import {RATE_LIMITS, clientIpFromHeaders, enforceRateLimit} from '@/lib/rate-limit';
import {registerSchema} from '@/lib/schemas/auth';

// Registration outcome consumed by the form via useActionState (login idiom):
// the happy path never RETURNS — signIn throws NEXT_REDIRECT to '/'. A
// returned ok:true means "account created but not signed in" (see below);
// ok:false carries message-KEY fieldErrors.
export type RegisterState = ActionResult<{created: true}>;

// Public action — registration is open to anonymous visitors by design (the
// proxy only guards /admin), so there is deliberately no authz call here.
export async function registerClient(
  _prevState: RegisterState | undefined,
  formData: FormData
): Promise<RegisterState> {
  // Rate-limit by client IP before any validation or DB write — registration is
  // an unauthenticated public write. Over-limit → typed non-field failure.
  const ip = clientIpFromHeaders(await headers());
  if (
    !enforceRateLimit(`register:${ip}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs)
      .allowed
  ) {
    return failure('rateLimited');
  }

  const parsed = registerSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? '')
  });
  if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
  const {name, email, password} = parsed.data;

  try {
    await prisma.user.create({
      data: {name, email, passwordHash: await hashPassword(password), role: 'CLIENT'}
    });
  } catch (error) {
    // Unique email taken → field-level KEY, exactly like a validation miss
    // (P2002 is the schema's own race-free uniqueness check).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return failure('validation', {email: 'emailTaken'});
    }
    throw error;
  }

  // Auto-sign-in JUDGMENT (plan: "auto-signs-in via the credentials flow…
  // reuse login-form idiom"): the login idiom IS a server action calling
  // signIn('credentials') — there is no client-side next-auth/react in this
  // codebase. Calling signIn right here (rather than a second round-trip from
  // the client) reuses that exact flow in one request, never holds the
  // plaintext password in client state after submit, and inherits the
  // NEXT_REDIRECT rethrow pattern from login/actions.ts verbatim.
  try {
    // Locale-prefixed on purpose: a bare '/' leans on the proxy to redirect,
    // and that middleware hop does not resolve during the client-side
    // navigation this action performs — the address bar moves while the old
    // page stays on screen until a manual refresh.
    await signIn('credentials', {email, password, redirectTo: `/${routing.defaultLocale}`});
  } catch (error) {
    // Practically unreachable (we just created these credentials), but if the
    // sign-in is refused the ACCOUNT still exists — surface success with a
    // sign-in link instead of an error that would invite a duplicate attempt.
    if (error instanceof AuthError) return success({created: true});
    throw error; // NEXT_REDIRECT on success must propagate
  }
  return success({created: true}); // not reached: signIn always redirects
}
