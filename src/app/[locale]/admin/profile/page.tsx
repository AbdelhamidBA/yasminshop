import {getTranslations} from 'next-intl/server';
import {PageHeader, PageTitle, Panel} from '@/components/admin/form';
import {Avatar, Overline, StatusLabel} from '@/components/admin/ui';
import {requirePageStaff} from '@/server/authz';
import {ProfilePasswordForm} from './password-form';

/**
 * The signed-in staff member's own account. Reachable by ADMIN and SUB_ADMIN
 * alike — everything here is scoped to the caller's own row.
 *
 * The identity block is read-only on purpose: the e-mail is the login identity
 * (as on the clients and sub-admins screens), and the role is not something an
 * account may grant itself. The password is the one thing you can change about
 * yourself here.
 */
export default async function AdminProfilePage() {
  const session = await requirePageStaff();
  const t = await getTranslations('adminProfile');

  const role = session.user.role === 'ADMIN' ? 'ADMIN' : 'SUB_ADMIN';
  const name = session.user.name ?? '';
  const email = session.user.email ?? '';

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={name} />
            <PageTitle>{t('title')}</PageTitle>
          </span>
        }
        badges={<StatusLabel tone="primary">{t(`roles.${role}`)}</StatusLabel>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title={t('identityCard')}
          className="self-start"
          bodyClassName="flex flex-col gap-4 text-sm"
        >
          <div className="flex flex-col gap-1">
            <Overline>{t('name')}</Overline>
            <div>{name}</div>
          </div>
          <div className="flex flex-col gap-1">
            <Overline>{t('email')}</Overline>
            <div dir="ltr">{email}</div>
            <p className="text-xs text-muted-foreground">{t('emailReadOnly')}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Overline>{t('role')}</Overline>
            <div>{t(`roles.${role}`)}</div>
          </div>
        </Panel>

        <div className="min-w-0 lg:col-span-2">
          <ProfilePasswordForm />
        </div>
      </div>
    </div>
  );
}
