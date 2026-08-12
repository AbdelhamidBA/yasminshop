import localFont from 'next/font/local';

// Baloo 2 — supplied by the store owner (fonts/ at the repo root, user commit
// f5ee476). Exposed as a CSS variable on <body> so portalled storefront
// surfaces (cart drawer, menus, bottom nav) resolve it too; the font-family
// itself is applied only inside .theme-yasmine (globals.css), so the admin
// and auth surfaces keep the default stack. Baloo 2 has no Arabic glyphs —
// Arabic text falls through to the system fallbacks per glyph, which is the
// intended behavior.
export const baloo = localFont({
  variable: '--font-baloo',
  display: 'swap',
  src: [
    {path: '../../fonts/Baloo2-Regular.ttf', weight: '400', style: 'normal'},
    {path: '../../fonts/Baloo2-Medium.ttf', weight: '500', style: 'normal'},
    {path: '../../fonts/Baloo2-SemiBold.ttf', weight: '600', style: 'normal'},
    {path: '../../fonts/Baloo2-Bold.ttf', weight: '700', style: 'normal'},
    {path: '../../fonts/Baloo2-ExtraBold.ttf', weight: '800', style: 'normal'}
  ]
});
