'use client';

import type {ReactNode} from 'react';
import {ThemeProvider as NextThemesProvider} from 'next-themes';

export function ThemeProvider({children}: {children: ReactNode}) {
  return (
    <NextThemesProvider
      attribute="class"
      // Light is the shop's default: the brand is a cream/gold palette and
      // that is how a first-time visitor should see it. The toggle still
      // switches, and the choice is remembered; only the OS preference no
      // longer decides for us.
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
