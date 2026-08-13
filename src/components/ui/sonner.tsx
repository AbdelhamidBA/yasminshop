'use client';

import {useTheme} from 'next-themes';
import {Toaster as Sonner, type ToasterProps} from 'sonner';
import {CheckIcon, InfoIcon, Loader2Icon, TriangleAlertIcon, XIcon} from 'lucide-react';

// Custom toast, styled after the Minimal UI snackbar: the status icon sits in
// a tinted rounded square, the message is the bold title, and an optional
// description sits under it in secondary ink. Borderless, floating shadow,
// 12px corners.
//
// The message stays the toast TITLE (plain text in the DOM), so every existing
// `toast.success('Sous-admin créé.')` call keeps rendering the same string the
// admin e2e specs assert on.
const iconBox =
  'flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5 [&>svg]:stroke-[2.5]';

const Toaster = ({...props}: ToasterProps) => {
  const {theme = 'system'} = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      // The toaster portals to <body>, outside every theme scope, so it was
      // painting on the DEFAULT shadcn palette — a neutral near-black panel
      // floating over the shop's warm brown surfaces in dark mode. Carry the
      // brand scope here: both the storefront and the dashboard now use this
      // palette, so toasts match wherever they appear.
      className="toaster group theme-yasmine"
      // Sonner hard-codes its own font stack on the toaster element, which
      // beats an inherited family; an inline style is what actually wins, so
      // toasts are set in the shop's face like everything else.
      style={{fontFamily: 'var(--font-baloo), ui-sans-serif, system-ui, sans-serif'}}
      icons={{
        success: (
          <span className={`${iconBox} bg-(--admin-success-soft) text-(--admin-success)`}>
            <CheckIcon />
          </span>
        ),
        info: (
          <span className={`${iconBox} bg-(--admin-info-soft) text-(--admin-info)`}>
            <InfoIcon />
          </span>
        ),
        warning: (
          <span className={`${iconBox} bg-(--admin-warning-soft) text-(--admin-warning)`}>
            <TriangleAlertIcon />
          </span>
        ),
        error: (
          <span className={`${iconBox} bg-(--admin-error-soft) text-(--admin-error)`}>
            <XIcon />
          </span>
        ),
        loading: (
          <span className={`${iconBox} bg-(--admin-neutral-soft) text-muted-foreground`}>
            <Loader2Icon className="animate-spin" />
          </span>
        )
      }}
      toastOptions={{
        // Sonner keeps its own layout; these classes restyle its parts.
        classNames: {
          toast:
            'group cn-toast !w-full !items-center !gap-3 !rounded-xl !border-0 !bg-popover !p-4 !text-popover-foreground shadow-float',
          // Sonner pins [data-icon] to 16x16 with its own margins. The tinted
          // 40px icon box overflowed that slot and ran underneath the message,
          // so the slot is resized to the box and the margins are dropped —
          // the toast's own gap-3 does the spacing.
          icon: '!m-0 !size-10 !shrink-0 !items-center !justify-center',
          content: '!gap-0.5',
          title: '!text-sm !font-bold !leading-snug',
          description: '!text-[13px] !leading-snug !text-muted-foreground',
          closeButton:
            '!border-0 !bg-transparent !text-muted-foreground hover:!bg-(--admin-neutral-soft)'
        }
      }}
      {...props}
    />
  );
};

export {Toaster};
