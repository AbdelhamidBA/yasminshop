// The site's canonical origin, in one place.
//
// Metadata needs it for three things Next cannot infer from a request: the
// metadataBase that turns relative OG image paths into absolute URLs (Open
// Graph consumers do not resolve relatives), the <link rel="canonical"> that
// tells search engines which of several reachable URLs is THE page, and the
// absolute entries in sitemap.xml.
//
// SITE_URL is read first so the value can be stated explicitly. AUTH_URL is the
// fallback because it already carries exactly this origin in production —
// next-auth builds its callbacks from it — which keeps a deployment from
// needing two variables that must agree and could silently drift apart.

const FALLBACK = 'http://localhost:3000';

function normalize(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    // Trailing slashes would produce '//fr' when joined with a path.
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Origin with no trailing slash, e.g. 'https://yasmine-shop.com'. */
export function siteOrigin(): string {
  return normalize(process.env.SITE_URL) ?? normalize(process.env.AUTH_URL) ?? FALLBACK;
}

/** Absolute URL for a path, e.g. absoluteUrl('/fr/products') . */
export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}
