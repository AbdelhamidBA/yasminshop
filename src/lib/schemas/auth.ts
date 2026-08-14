import {z} from 'zod';

// Client-facing auth schemas (registration + password reset). Same contract as
// checkoutSchema (spec §6c binding): every constraint carries a message KEY —
// never zod's default English text — which the UI translates via
// t(`authPages.errors.${key}`). Keys: 'required', 'tooShort', 'tooLong',
// 'invalidEmail', 'passwordTooShort', 'passwordMismatch'.

// Passwords are NOT trimmed — whitespace is a legal password character and
// trimming here would diverge from what authorize()/bcrypt later compares.
const passwordField = z
  .string()
  .min(1, {message: 'required'})
  .min(8, {message: 'passwordTooShort'})
  .max(200, {message: 'tooLong'});

const confirmField = z.string().min(1, {message: 'required'});

// Cross-field match. Zod 4 runs refinements even when per-field checks fail,
// so the predicate skips empty fields explicitly — an empty password/confirm
// surfaces 'required' alone, and 'passwordMismatch' only appears when both
// fields are filled but differ (fieldErrorsFromZod keeps the first issue per
// path either way).
const matchesConfirm = (data: {password: string; confirmPassword: string}) =>
  data.password.length === 0 ||
  data.confirmPassword.length === 0 ||
  data.password === data.confirmPassword;

const passwordMatch = {
  message: 'passwordMismatch',
  path: ['confirmPassword'] as string[]
};

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, {message: 'required'})
      .min(2, {message: 'tooShort'})
      .max(120, {message: 'tooLong'}),
    email: z
      .string()
      .trim()
      .min(1, {message: 'required'})
      .max(254, {message: 'tooLong'})
      .email({message: 'invalidEmail'}),
    password: passwordField,
    confirmPassword: confirmField
  })
  .refine(matchesConfirm, passwordMatch);
export type RegisterInput = z.output<typeof registerSchema>;

export const newPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: confirmField
  })
  .refine(matchesConfirm, passwordMatch);
export type NewPasswordInput = z.output<typeof newPasswordSchema>;

// Signed-in password change (the staff profile page). Same password rules as
// registration and the token reset, plus two things the token flow does not
// need. The CURRENT password, because a live session must not be enough on its
// own to take an account over — the token flow proves ownership with a mailed
// link instead, so it has no equivalent to ask for. And a difference check, so
// "changing" a password cannot quietly be a no-op that still reports success.
//
// Both extra refinements skip empty fields for the same reason matchesConfirm
// does: zod 4 runs refinements even when the per-field checks failed, and an
// empty box should say 'required' rather than a cross-field complaint.
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, {message: 'required'})
      .max(200, {message: 'tooLong'}),
    password: passwordField,
    confirmPassword: confirmField
  })
  .refine(matchesConfirm, passwordMatch)
  .refine(
    (data) =>
      data.currentPassword.length === 0 ||
      data.password.length === 0 ||
      data.currentPassword !== data.password,
    {message: 'passwordUnchanged', path: ['password']}
  );
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
