import {describe, expect, test} from 'vitest';
import {MAX_MILLIMES} from '../money';
import {categorySchema, parametersSchema, productSchema, promoCodeSchema} from './catalog';

describe('categorySchema', () => {
  test('empty parentId becomes null', () => {
    const parsed = categorySchema.parse({nameFr: 'Audio', nameAr: 'صوتيات', parentId: ''});
    expect(parsed.parentId).toBeNull();
  });
  test('rejects blank names', () => {
    expect(categorySchema.safeParse({nameFr: ' ', nameAr: 'x'}).success).toBe(false);
  });
});

describe('promoCodeSchema', () => {
  test('uppercases the code', () => {
    const parsed = promoCodeSchema.parse({code: 'ete-2026', percentOff: 10, active: true, expiresAt: null});
    expect(parsed.code).toBe('ETE-2026');
  });
  test('rejects percentOff outside 1..100', () => {
    expect(promoCodeSchema.safeParse({code: 'ABC', percentOff: 0, active: true, expiresAt: null}).success).toBe(false);
    expect(promoCodeSchema.safeParse({code: 'ABC', percentOff: 101, active: true, expiresAt: null}).success).toBe(false);
  });
});

describe('productSchema', () => {
  const valid = {
    reference: 'REF-1',
    nameFr: 'Casque',
    nameAr: 'سماعات',
    descriptionFr: 'Desc',
    descriptionAr: 'وصف',
    priceMillimes: 89_000,
    discountPct: 0,
    quantity: 5,
    featured: false,
    categoryId: 'c1',
    subCategoryId: '',
    images: [{url: '/api/uploads/products/x.webp', sortOrder: 0}]
  };
  test('accepts a valid product and nulls empty subCategoryId', () => {
    const parsed = productSchema.parse(valid);
    expect(parsed.subCategoryId).toBeNull();
  });
  test('requires at least one image', () => {
    expect(productSchema.safeParse({...valid, images: []}).success).toBe(false);
  });
  test('rejects discount above 100', () => {
    expect(productSchema.safeParse({...valid, discountPct: 101}).success).toBe(false);
  });
  test('accepts priceMillimes at MAX_MILLIMES and rejects above', () => {
    expect(productSchema.safeParse({...valid, priceMillimes: MAX_MILLIMES}).success).toBe(true);
    expect(productSchema.safeParse({...valid, priceMillimes: MAX_MILLIMES + 1}).success).toBe(false);
  });
});

describe('parametersSchema', () => {
  const valid = {
    deliveryCostMillimes: 7_000,
    freeDeliveryThresholdMillimes: 100_000,
    currency: 'TND',
    lastChanceThreshold: 5,
    copyright: '',
    siteDescription: '',
    keywords: '',
    socialLinks: {facebook: '', instagram: '', tiktok: ''}
  };
  test('accepts millimes fields at MAX_MILLIMES', () => {
    const bounded = {
      ...valid,
      deliveryCostMillimes: MAX_MILLIMES,
      freeDeliveryThresholdMillimes: MAX_MILLIMES
    };
    expect(parametersSchema.safeParse(bounded).success).toBe(true);
  });
  test('rejects deliveryCostMillimes above MAX_MILLIMES', () => {
    expect(
      parametersSchema.safeParse({...valid, deliveryCostMillimes: MAX_MILLIMES + 1000}).success
    ).toBe(false);
  });
  test('rejects freeDeliveryThresholdMillimes above MAX_MILLIMES', () => {
    expect(
      parametersSchema.safeParse({...valid, freeDeliveryThresholdMillimes: MAX_MILLIMES + 1}).success
    ).toBe(false);
  });
});
