import 'server-only';
import {generateVAPIDKeys, sendNotification, setVapidDetails} from 'web-push';
import {prisma} from '@/lib/db';
import {sendToSubscriptions} from '@/lib/push';

// Server-only Web Push send path. `server-only` + the top-level `web-push`
// import guarantee this module (and web-push itself) can never be pulled into a
// client bundle — the build fails loudly if anything client-side imports it.
// The pure fan-out/prune logic lives in @/lib/push (kept web-push- and env-free
// so it stays unit-testable); this module owns everything server-side: the VAPID
// env read + key memo, wiring web-push (the real send), and Prisma (the real
// prune).

export type PushPayload = {title: string; body: string; url: string};

export type VapidDetails = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

// Process-memoized VAPID details (the PROMISE is cached so a burst of first
// callers can't each generate a different dev keypair). Memoization is what makes
// the subscribe path — which hands the browser the PUBLIC key via
// /api/push/vapid-public-key — and the send path below agree on ONE keypair
// within a single server run. Both routes import THIS module, so they share it.
let vapidPromise: Promise<VapidDetails> | null = null;

export function getVapidDetails(): Promise<VapidDetails> {
  if (!vapidPromise) vapidPromise = resolveVapidDetails();
  return vapidPromise;
}

async function resolveVapidDetails(): Promise<VapidDetails> {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  // web-push requires a mailto: or https: subject; fall back to a placeholder so
  // the dev path works out of the box.
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@example.com';

  if (publicKey && privateKey) {
    return {publicKey, privateKey, subject};
  }

  // DEV fallback: generate an ephemeral keypair ONCE per process.
  const generated = generateVAPIDKeys();
  console.warn(
    'DEV ONLY — set VAPID_* in .env. Generated an ephemeral VAPID keypair; ' +
      'push subscriptions stop delivering after a server restart.'
  );
  return {publicKey: generated.publicKey, privateKey: generated.privateKey, subject};
}

// Convenience for the GET /api/push/vapid-public-key endpoint (the browser needs
// only the public key to create a subscription).
export async function getVapidPublicKey(): Promise<string> {
  return (await getVapidDetails()).publicKey;
}

// Best-effort broadcast to every staff push subscription. Callers (createOrderCore)
// invoke this fire-and-forget inside their own try/catch — it also guards itself
// so a VAPID-config error or an all-failed batch can never throw into the order
// path. Dead subscriptions (404/410) are pruned by the injected `remove`.
export async function sendPushToAllStaff(payload: PushPayload): Promise<void> {
  try {
    const subs = await prisma.pushSubscription.findMany({
      select: {endpoint: true, keysJson: true}
    });
    if (subs.length === 0) return;

    const vapid = await getVapidDetails();
    setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    const body = JSON.stringify(payload);
    await sendToSubscriptions(subs, body, {
      send: (sub, data) =>
        sendNotification(
          {endpoint: sub.endpoint, keys: sub.keysJson as {p256dh: string; auth: string}},
          data
        ),
      remove: (endpoint) => prisma.pushSubscription.delete({where: {endpoint}})
    });
  } catch {
    // Best-effort: any failure (DB unreachable, bad VAPID subject, web-push
    // throwing before the per-subscription loop) is swallowed so push can never
    // affect the caller. The in-app notification bell is the reliable channel.
  }
}
