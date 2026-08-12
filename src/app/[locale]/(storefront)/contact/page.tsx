import {getTranslations, setRequestLocale} from 'next-intl/server';
import {HandCoins, Mail, Phone} from 'lucide-react';
import {getParameters} from '@/server/settings';

// Contact — renders the owner-configurable contact details (contactPhone /
// contactEmail Settings, managed in admin Parameters). Empty values hide
// their field; when both are unset the page falls back to the honest
// order-online-and-we-call-you note. No invented phone/email, ever.
export default async function ContactPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const [t, parameters] = await Promise.all([getTranslations('contact'), getParameters()]);

  const phone = parameters.contactPhone;
  const email = parameters.contactEmail;
  const hasDetails = phone !== '' || email !== '';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{t('lead')}</p>
      </div>

      {hasDetails ? (
        <ul className="mt-10 flex flex-col gap-4">
          {phone !== '' && (
            <li className="flex items-center gap-4 rounded-lg border bg-secondary/40 p-5">
              <Phone className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{t('phoneTitle')}</h2>
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  dir="ltr"
                  className="mt-0.5 block truncate font-medium hover:underline"
                >
                  {phone}
                </a>
              </div>
            </li>
          )}
          {email !== '' && (
            <li className="flex items-center gap-4 rounded-lg border bg-secondary/40 p-5">
              <Mail className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{t('emailTitle')}</h2>
                <a
                  href={`mailto:${email}`}
                  dir="ltr"
                  className="mt-0.5 block truncate font-medium hover:underline"
                >
                  {email}
                </a>
              </div>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-10 rounded-lg border bg-secondary/40 p-5 text-center text-muted-foreground">
          {t('fallback')}
        </p>
      )}

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <HandCoins className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {t('codNote')}
      </p>
    </div>
  );
}
