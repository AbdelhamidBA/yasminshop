// Pure Web Push helpers. Deliberately free of `server-only`, of any DB access,
// of a *static* `web-push` import, AND of any env/VAPID read so the fan-out logic
// below stays unit-testable without a browser, a database, or the web-push
// library. The VAPID key surface (env read + dynamic web-push import) lives in
// the server-only src/server/push.ts; the real order-alert path there injects
// web-push's sendNotification and Prisma's delete, while the tests inject fakes.

// Web Push status semantics: a 404 (Not Found) or 410 (Gone) from the push
// service means the subscription is permanently dead and MUST be pruned. Every
// other outcome — a transient 5xx, a 429 rate-limit, a network error surfacing
// as `undefined` — is retryable, so the row is KEPT and retried on the next
// order. This is the single source of the prune/keep decision.
export function classifyPushError(statusCode: number | undefined): 'prune' | 'keep' {
  return statusCode === 404 || statusCode === 410 ? 'prune' : 'keep';
}

// The subset of a PushSubscription row the send path needs. `keysJson` is the
// browser-supplied {p256dh, auth} pair (Prisma Json → unknown here); the real
// send dep casts it to web-push's shape.
export type SendableSubscription = {
  endpoint: string;
  keysJson: unknown;
};

export type PushDeliveryDeps = {
  // Sends one notification. Resolves on success; rejects on failure with a value
  // that MAY carry a numeric `statusCode` (web-push's WebPushError shape).
  send: (sub: SendableSubscription, payload: string) => Promise<unknown>;
  // Removes a dead subscription by endpoint (Prisma delete in production).
  remove: (endpoint: string) => Promise<unknown>;
};

export type SendSummary = {sent: number; pruned: number; kept: number};

// Reads a numeric `statusCode` off an unknown thrown value (web-push rejects
// with a WebPushError that exposes one). Anything else → undefined → 'keep'.
function statusCodeOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const code = (error as {statusCode: unknown}).statusCode;
    if (typeof code === 'number') return code;
  }
  return undefined;
}

// Best-effort fan-out to every staff subscription. For each one: attempt the
// send; on failure, classify the push-service status — 404/410 prune the row,
// everything else is left for a later retry. NEVER throws: a single failing
// send, or a failing prune, can neither abort the loop nor bubble into the
// caller (order creation). Returns a summary for logging/tests.
export async function sendToSubscriptions(
  subs: SendableSubscription[],
  payload: string,
  deps: PushDeliveryDeps
): Promise<SendSummary> {
  const summary: SendSummary = {sent: 0, pruned: 0, kept: 0};
  for (const sub of subs) {
    try {
      await deps.send(sub, payload);
      summary.sent += 1;
    } catch (error) {
      if (classifyPushError(statusCodeOf(error)) === 'prune') {
        summary.pruned += 1;
        try {
          await deps.remove(sub.endpoint);
        } catch {
          // A failed prune is non-fatal: the dead row simply lingers and is
          // re-pruned on the next order. Cleanup must never abort the fan-out.
        }
      } else {
        summary.kept += 1;
      }
    }
  }
  return summary;
}
