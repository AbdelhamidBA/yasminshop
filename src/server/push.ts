import 'server-only';
import {sendNotification, setVapidDetails} from 'web-push';
import {prisma} from '@/lib/db';
import {getVapidDetails, sendToSubscriptions} from '@/lib/push';

// Server-only Web Push send path. `server-only` + the top-level `web-push`
// import guarantee this module (and web-push itself) can never be pulled into a
// client bundle — the build fails loudly if anything client-side imports it.
// The pure fan-out/prune logic lives in @/lib/push; this module only wires it to
// web-push (the real send) and Prisma (the real prune) and reads the VAPID keys.

export type PushPayload = {title: string; body: string; url: string};

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
