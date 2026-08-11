import type {ZodError} from 'zod';

export type ActionResult<T = void> =
  | {ok: true; data: T}
  | {ok: false; error: string; fieldErrors?: Record<string, string>};

export function success<T>(data: T): ActionResult<T> {
  return {ok: true, data};
}

export function failure(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return fieldErrors ? {ok: false, error, fieldErrors} : {ok: false, error};
}

export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
