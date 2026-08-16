import {describe, expect, test} from 'vitest';
import {ADDRESS_CITY_SEPARATOR, splitAddress} from './address';

describe('splitAddress', () => {
  test('undoes the fold createOrderCore applies', () => {
    const address = '12 rue de Marseille';
    const city = 'Tunis';
    expect(splitAddress(`${address}${ADDRESS_CITY_SEPARATOR}${city}`)).toEqual({address, city});
  });

  test('the LAST separator wins, so a street line may contain commas', () => {
    expect(splitAddress('12, rue de Marseille, Immeuble B, Sousse')).toEqual({
      address: '12, rue de Marseille, Immeuble B',
      city: 'Sousse'
    });
  });

  test('no separator means the whole value is the address and the city is unknown', () => {
    // Inventing a city from the tail of a street name would be worse than
    // reporting that we do not have one.
    expect(splitAddress('Cité El Ghazala')).toEqual({address: 'Cité El Ghazala', city: ''});
  });

  test('handles the degenerate ends without inventing content', () => {
    expect(splitAddress('')).toEqual({address: '', city: ''});
    expect(splitAddress('Tunis, ')).toEqual({address: 'Tunis', city: ''});
    expect(splitAddress(', Tunis')).toEqual({address: '', city: 'Tunis'});
  });

  test('a non-string never throws', () => {
    // The callers read from the database, but the guard keeps a bad row or a
    // future nullable column from taking a page down.
    expect(splitAddress(null as unknown as string)).toEqual({address: '', city: ''});
  });
});
