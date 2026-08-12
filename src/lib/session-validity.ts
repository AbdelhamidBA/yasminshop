// Pure, edge-safe decision for JWT session revocation (no prisma, no imports):
// a session's embedded tokenVersion must equal the user's current DB
// tokenVersion. Every revocation event (password reset, archive/restore,
// role/credential change) increments the DB version, so any token minted before
// that event no longer matches and is rejected on the next protected access.
//
// Strict equality (not `<`) is deliberate: a token whose version is somehow
// ahead of the DB is also treated as invalid rather than trusted.
export function sessionStillValid(tokenVersion: number, dbVersion: number): boolean {
  return tokenVersion === dbVersion;
}
