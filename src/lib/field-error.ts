// Shared field-error localizer for every admin/client form. Server actions
// return `fieldErrors` as message CODES (e.g. 'required', 'tooLong',
// 'invalidAmount') — never English — via fieldErrorsFromZod + the schemas'
// message keys. This helper maps a code to a LOCALIZED string through the
// CURRENT form's `errors.*` namespace (the passed `t` is already scoped to that
// form), falling back to the generic `errors.validation`. It NEVER echoes the
// raw code or zod's default English back to the user.

// Minimal shape of a next-intl translator scoped to a namespace that owns an
// `errors` sub-object. The `never` key type lets the string-built lookup keys
// pass the translator's strict key union — the same `as never` idiom the call
// sites already use for dynamic keys.
type ErrorTranslator = {
  (key: never): string;
  has: (key: never) => boolean;
};

export function fieldErrorText(code: string, t: ErrorTranslator): string {
  const key = `errors.${code}` as never;
  if (t.has(key)) return t(key);
  return t('errors.validation' as never);
}
