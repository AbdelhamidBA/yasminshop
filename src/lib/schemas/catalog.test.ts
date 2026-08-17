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
    // Most products have no gros price; null is the ordinary case, not an edge.
    wholesalePriceMillimes: null,
    wholesaleMinQty: null,
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
  test('accepts a wholesale price with or without its own threshold', () => {
    const withGros = {...valid, wholesalePriceMillimes: 20_000};
    expect(productSchema.safeParse(withGros).success).toBe(true);
    expect(productSchema.safeParse({...withGros, wholesaleMinQty: 3}).success).toBe(true);
  });
  test('rejects a wholesale threshold that would price every single unit', () => {
    // 1 or 0 is not a bulk deal, it is the product's price — and almost
    // certainly a typo the admin should see rather than a silent repricing.
    const withGros = {...valid, wholesalePriceMillimes: 20_000};
    expect(productSchema.safeParse({...withGros, wholesaleMinQty: 1}).success).toBe(false);
    expect(productSchema.safeParse({...withGros, wholesaleMinQty: 0}).success).toBe(false);
    expect(productSchema.safeParse({...withGros, wholesaleMinQty: 2}).success).toBe(true);
  });
  test('rejects a threshold the cart could never reach', () => {
    const withGros = {...valid, wholesalePriceMillimes: 20_000};
    expect(productSchema.safeParse({...withGros, wholesaleMinQty: 100}).success).toBe(false);
    expect(productSchema.safeParse({...withGros, wholesaleMinQty: 99}).success).toBe(true);
  });
});

describe('parametersSchema', () => {
  const valid = {
    deliveryCostMillimes: 7_000,
    freeDeliveryThresholdMillimes: 100_000,
    currency: 'TND',
    lastChanceThreshold: 5,
    wholesaleMinQty: 5,
    copyright: '',
    siteDescription: '',
    keywords: '',
    contactPhone: '',
    contactEmail: '',
    socialLinks: {facebook: '', instagram: '', tiktok: ''}
  };
  test('rejects a shop-wide wholesale threshold below 2', () => {
    expect(parametersSchema.safeParse({...valid, wholesaleMinQty: 1}).success).toBe(false);
    expect(parametersSchema.safeParse({...valid, wholesaleMinQty: 2}).success).toBe(true);
  });
  test('accepts empty contact details (both optional) and trims provided values', () => {
    expect(parametersSchema.safeParse(valid).success).toBe(true);
    const parsed = parametersSchema.parse({
      ...valid,
      contactPhone: ' 21 000 000 ',
      contactEmail: ' owner@example.tn '
    });
    expect(parsed.contactPhone).toBe('21 000 000');
    expect(parsed.contactEmail).toBe('owner@example.tn');
  });
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
