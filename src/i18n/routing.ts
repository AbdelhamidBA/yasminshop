import {defineRouting} from 'next-intl/routing';

// French only. Arabic was removed from the product (routing, UI and form
// fields) but messages/ar.json is deliberately kept on disk: re-enabling the
// locale is adding 'ar' back to this list, not re-translating the catalogue.
export const routing = defineRouting({
  locales: ['fr'],
  defaultLocale: 'fr'
});
