import type {CSSProperties} from 'react';
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {formatMillimes} from '@/lib/money';
import {requirePageStaff} from '@/server/authz';
import {getOrder} from '@/server/orders';
import {getParameters} from '@/server/settings';
import {PrintButton} from './print-button';

// Printable order invoice.
//
// ROUTING CHOICE (documented per plan Task 5): this route lives OUTSIDE the
// /admin segment on purpose. admin/layout.tsx wraps ALL of admin/* with the
// sidebar + header chrome, and a nested layout cannot REMOVE what its parent
// renders — so /admin/orders/[id]/invoice could never be print-clean. Placing
// the page at /[locale]/invoice/[id] keeps it under the root locale layout
// only (html/body + providers, zero chrome). It is still staff-guarded: the
// proxy's ADMIN_PATH edge check does not cover /invoice, so requirePageStaff()
// below is the sole — and sufficient — gate (anonymous → 307 /login, exactly
// like every admin page's server-side guard). The order-id cuid scalar guard
// lives inside getOrder() (charset allowlist → null → notFound).
//
// The invoice is a paper document: it hard-codes a white/neutral palette
// (independent of the admin dark theme) and reinforces it with Tailwind
// print: variants — no global CSS edits needed. Width is A4-ish (210mm).
export default async function InvoicePage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  await requirePageStaff();
  const {locale, id} = await params;
  const [t, parameters, order] = await Promise.all([
    getTranslations(),
    getParameters(),
    getOrder(id)
  ]);
  if (!order) notFound();

  const currencyLabel = parameters.currency;
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'long'
  });
  const socialLinks = Object.values(parameters.socialLinks).filter((url) => url !== '');
  // Owner-configured contact details only. Both default to '' (server/settings
  // DEFAULT_PARAMETERS) — an unconfigured shop prints no contact line at all
  // rather than an invented one. No address / tax id / bank details exist in
  // the parameters, so the letterhead carries none.
  const contactLines = [parameters.contactPhone, parameters.contactEmail].filter(
    (value) => value !== ''
  );

  return (
    // The invoice renders outside both theme scopes, so --font-sans is never
    // given a value here and every font-sans utility would fall back to the
    // browser default (the same trap that left the admin in Times New Roman).
    // Define it locally so the document is set in the shop's own face.
    <div
      style={{'--font-sans': 'var(--font-baloo), ui-sans-serif, system-ui, sans-serif'} as CSSProperties}
      className="min-h-svh bg-white font-sans text-neutral-900 print:bg-white print:text-black"
    >
      {/* Paper margins. @page has no Tailwind equivalent and the printed sheet
          needs its own gutter: the container drops its padding under print:,
          so with a margin-less print setting (and with Playwright's
          page.pdf(), whose default margin is 0) the letterhead and the totals
          would sit flush against — and be clipped by — the sheet edge. React
          hoists this into <head>. */}
      <style href="invoice-print" precedence="default">{`@page { margin: 14mm; }`}</style>
      <div className="mx-auto w-full max-w-[210mm] px-8 py-8 print:max-w-none print:p-0">
        <div className="mb-6 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-neutral-900 pb-6">
          <div className="flex flex-col gap-2">
            {/* The letterhead lockup: the shop's mark beside "Yasmine" in the
                Betterlett script over a ruled SHOP — the storefront's
                BrandLockup shape, rebuilt locally for paper. Importing that
                component would drag in its <Link href="/"> (a nav target is
                meaningless on a printed invoice) and its rules flanking SHOP
                are drawn with background colour, which Chrome discards when
                "Background graphics" is off; borders survive that setting. */}
            <div className="flex items-center gap-3">
              <img
                // The 322x445 PNG, not the 87x120 webp the screens use: on paper
                // the small asset lands around 200 dpi and prints soft.
                src="/brand/yasmine-logo.png"
                alt=""
                width={87}
                height={120}
                className="h-14 w-auto"
                /* An <img> is content, not decoration, so it prints even with
                   background graphics off; this keeps the browser's colour
                   economy from flattening the gold on top of that. */
                style={{printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'}}
              />
              {/* Latin wordmark in both locales: Betterlett has no Arabic
                  glyphs and the brand name is the Latin one (see fonts.ts). */}
              <span className="flex flex-col items-center">
                <span className="font-(family-name:--font-betterlett) text-3xl leading-none">
                  Yasmine
                </span>
                <span className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-none font-semibold tracking-[0.28em] text-neutral-600 uppercase print:text-black">
                  <span aria-hidden="true" className="w-4 border-t border-neutral-500" />
                  Shop
                  <span aria-hidden="true" className="w-4 border-t border-neutral-500" />
                </span>
              </span>
            </div>
            {parameters.siteDescription !== '' && (
              <p className="max-w-xs text-sm text-neutral-600">{parameters.siteDescription}</p>
            )}
            {contactLines.length > 0 && (
              <p dir="ltr" className="text-xs text-neutral-600">
                {contactLines.join(' · ')}
              </p>
            )}
            {socialLinks.length > 0 && (
              <p dir="ltr" className="text-xs text-neutral-500">
                {socialLinks.join(' · ')}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1 text-end">
            <h1 className="text-2xl font-semibold uppercase tracking-wide">
              {t('invoice.title')}
            </h1>
            <div className="text-sm font-medium">
              {t('invoice.orderNumber', {number: order.number})}
            </div>
            <div className="text-sm text-neutral-600">
              {t('invoice.date')}: {dateFormatter.format(order.createdAt)}
            </div>
          </div>
        </header>

        <section className="mt-6 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t('invoice.billedTo')}
          </div>
          <div className="mt-1 font-medium">{order.customerName}</div>
          <div className="text-neutral-600">
            {t('invoice.phone')}: <span dir="ltr">{order.customerPhone}</span>
          </div>
          <div className="text-neutral-600">
            {t('invoice.address')}: {order.customerAddress}
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 text-start font-semibold">{t('invoice.product')}</th>
              <th className="py-2 text-end font-semibold">{t('invoice.unitPrice')}</th>
              <th className="py-2 text-end font-semibold">{t('invoice.qty')}</th>
              <th className="py-2 text-end font-semibold">{t('invoice.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-200 break-inside-avoid">
                <td className="py-2 pe-4">
                  {/* Snapshot names — Arabic invoices prefer the Arabic
                      snapshot, || falls back for pre-Phase-4 items. */}
                  {locale === 'ar'
                    ? item.nameArSnapshot || item.nameSnapshot
                    : item.nameSnapshot}
                </td>
                <td className="py-2 text-end tabular-nums whitespace-nowrap">
                  {formatMillimes(item.unitPriceMillimes)} {currencyLabel}
                </td>
                <td className="py-2 text-end tabular-nums">{item.qty}</td>
                <td className="py-2 text-end tabular-nums whitespace-nowrap">
                  {formatMillimes(item.lineTotalMillimes)} {currencyLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* The closing block travels as ONE unit when printing: totals, the
            COD note and the signature. break-inside-avoid on the signature
            alone would still let it start a page by itself; keeping it glued
            to the totals means a spill-over carries the whole sign-off, never
            an orphan page holding only a signature. (The per-row
            break-inside-avoid above keeps working — it is scoped to <tr>.) */}
        <div className="break-inside-avoid">
          <dl className="ms-auto mt-6 flex w-full max-w-xs flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600">{t('invoice.subtotal')}</dt>
              <dd className="tabular-nums">
                {formatMillimes(order.subtotalMillimes)} {currencyLabel}
              </dd>
            </div>
            {order.promoDiscountMillimes > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-neutral-600">
                  {t('invoice.promoDiscount')}
                  {order.promoCode !== null && (
                    <>
                      {' '}
                      <span dir="ltr" className="text-xs">({order.promoCode})</span>
                    </>
                  )}
                </dt>
                <dd dir="ltr" className="tabular-nums">
                  -{formatMillimes(order.promoDiscountMillimes)} {currencyLabel}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600">{t('invoice.delivery')}</dt>
              <dd className="tabular-nums">
                {order.deliveryCostMillimes === 0
                  ? t('invoice.deliveryFree')
                  : `${formatMillimes(order.deliveryCostMillimes)} ${currencyLabel}`}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t-2 border-neutral-900 pt-2 text-base font-bold">
              <dt>{t('invoice.total')}</dt>
              <dd className="tabular-nums">
                {formatMillimes(order.totalMillimes)} {currencyLabel}
              </dd>
            </div>
          </dl>

          <p className="mt-8 border border-neutral-300 p-3 text-center text-sm text-neutral-700">
            {t('invoice.codNote')}
          </p>

          {/* Sign-off: the scripted wordmark resting on the signature rule,
              captioned underneath — where a signature belongs on a document,
              after the last figure and above the page footer. */}
          <section className="ms-auto mt-10 w-64 text-center">
            <div className="font-(family-name:--font-betterlett) pb-1 text-3xl leading-none">
              Yasmine Shop
            </div>
            <div className="border-t border-neutral-900" />
            <div className="mt-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase print:text-neutral-700">
              {t('invoice.signatureCaption')}
            </div>
          </section>
        </div>

        <footer className="mt-8 border-t border-neutral-300 pt-4 text-center text-xs text-neutral-500">
          {parameters.copyright}
        </footer>
      </div>
    </div>
  );
}
