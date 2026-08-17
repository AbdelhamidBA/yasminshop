import {afterEach, describe, expect, test} from 'vitest';
import {absoluteUrl, siteOrigin} from './site-url';

const saved = {SITE_URL: process.env.SITE_URL, AUTH_URL: process.env.AUTH_URL};

afterEach(() => {
  process.env.SITE_URL = saved.SITE_URL;
  process.env.AUTH_URL = saved.AUTH_URL;
  if (saved.SITE_URL === undefined) delete process.env.SITE_URL;
  if (saved.AUTH_URL === undefined) delete process.env.AUTH_URL;
});

describe('siteOrigin', () => {
  test('prefers SITE_URL', () => {
    process.env.SITE_URL = 'https://yasmine-shop.com';
    process.env.AUTH_URL = 'https://something-else.example';
    expect(siteOrigin()).toBe('https://yasmine-shop.com');
  });

  test('falls back to AUTH_URL, which already carries this origin in production', () => {
    delete process.env.SITE_URL;
    process.env.AUTH_URL = 'https://yasmine-shop.com';
    expect(siteOrigin()).toBe('https://yasmine-shop.com');
  });

  test('strips paths and trailing slashes', () => {
    // A trailing slash would produce '//fr' once a path is appended.
    process.env.SITE_URL = 'https://yasmine-shop.com/';
    expect(siteOrigin()).toBe('https://yasmine-shop.com');
    process.env.SITE_URL = 'https://yasmine-shop.com/fr/products';
    expect(siteOrigin()).toBe('https://yasmine-shop.com');
  });

  test('a malformed value falls through rather than poisoning every URL', () => {
    process.env.SITE_URL = 'not a url';
    process.env.AUTH_URL = 'https://yasmine-shop.com';
    expect(siteOrigin()).toBe('https://yasmine-shop.com');
  });

  test('with nothing configured it is localhost, never an empty origin', () => {
    delete process.env.SITE_URL;
    delete process.env.AUTH_URL;
    expect(siteOrigin()).toBe('http://localhost:3000');
  });

  test('keeps a non-default port', () => {
    process.env.SITE_URL = 'http://192.0.2.1:3002';
    expect(siteOrigin()).toBe('http://192.0.2.1:3002');
  });
});

describe('absoluteUrl', () => {
  test('joins without doubling or dropping the slash', () => {
    process.env.SITE_URL = 'https://yasmine-shop.com';
    expect(absoluteUrl('/fr/products')).toBe('https://yasmine-shop.com/fr/products');
    expect(absoluteUrl('fr/products')).toBe('https://yasmine-shop.com/fr/products');
    expect(absoluteUrl('/')).toBe('https://yasmine-shop.com/');
  });
});
