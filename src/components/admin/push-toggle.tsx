'use client';

import {useEffect, useState} from 'react';
import {BellOff, BellRing, LoaderCircle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';

// Admin push toggle (Phase 5 Task 5). Feature-detects Service Worker + Push +
// Notification support and renders NOTHING when the browser can't do web push.
// Enable: request permission → register /sw.js → fetch the VAPID public key from
// the staff endpoint → subscribe → POST the subscription. Disable: unsubscribe
// locally + POST /api/push/unsubscribe. All network is same-origin /api/push/*
// (never locale-prefixed). This is a client leaf — web-push and the DB never
// come near it; it only speaks to the route handlers.

// VAPID public keys are base64url; PushManager wants the raw bytes.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushToggle() {
  const t = useTranslations('push');
  // undefined = not yet feature-detected (avoids an SSR/CSR flash); false = the
  // browser lacks the APIs, so we render nothing.
  const [supported, setSupported] = useState<boolean | undefined>(undefined);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const ok =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (!ok) return;
    // Reflect any existing subscription so the button starts in the right state.
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setEnabled(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function enable() {
    if (Notification.permission === 'denied') {
      // The browser refused the permission — nothing failed in the app.
      toast.warning(t('denied'));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      // The browser refused the permission — nothing failed in the app.
      toast.warning(t('denied'));
      return;
    }
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const keyResponse = await fetch('/api/push/vapid-public-key');
    if (!keyResponse.ok) throw new Error('vapid-key');
    const {publicKey} = (await keyResponse.json()) as {publicKey?: string};
    if (!publicKey) throw new Error('vapid-key');

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys) throw new Error('subscription');
    const postResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({endpoint: json.endpoint, keys: json.keys})
    });
    if (!postResponse.ok) throw new Error('subscribe');

    setEnabled(true);
    toast.success(t('enabled'));
  }

  async function disable() {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const {endpoint} = subscription;
      await subscription.unsubscribe();
      // Best-effort server cleanup; the local unsubscribe already stops delivery.
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({endpoint})
      }).catch(() => {});
    }
    setEnabled(false);
    toast.info(t('disabled'));
  }

  async function onClick() {
    if (pending) return;
    setPending(true);
    try {
      if (enabled) await disable();
      else await enable();
    } catch {
      toast.error(t('error'));
    } finally {
      setPending(false);
    }
  }

  // Not feature-detected yet, or unsupported → render nothing.
  if (!supported) return null;

  const label = enabled ? t('disable') : t('enable');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      title={label}
      aria-pressed={enabled}
      className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground sm:size-9 transition-colors outline-none hover:bg-(--admin-neutral-soft) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {pending ? (
        <LoaderCircle className="size-5 animate-spin" />
      ) : enabled ? (
        <BellRing className="size-5 text-primary" strokeWidth={1.8} />
      ) : (
        <BellOff className="size-5" strokeWidth={1.8} />
      )}
    </button>
  );
}
