import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {RequestResetForm} from './request-form';

// Public page (the proxy only guards /admin — no middleware change needed).
export default async function ResetPasswordRequestPage() {
  const t = await getTranslations('authPages');

  return (
    <>
      <h1 className="text-3xl leading-none font-extrabold">{t('reset.requestTitle')}</h1>
      <div className="mt-8">
        <RequestResetForm />
      </div>
      <p className="mt-8 border-t border-dotted pt-6 text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('links.backToLogin')}
        </Link>
      </p>
    </>
  );
}
