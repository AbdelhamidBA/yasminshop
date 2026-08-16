// Orders store the delivery address as ONE snapshot column: the schema has no
// city field, so createOrderCore folds the two entered parts together as
// `${address}, ${city}`. Anything reading an order back and needing the parts
// again has to undo that fold, so the inverse lives here rather than being
// re-derived at each call site (the admin's edit dialog and the client-profile
// backfill both need it).

/** How createOrderCore joins the two entered parts. Keep the two in step. */
export const ADDRESS_CITY_SEPARATOR = ', ';

/**
 * Best-effort inverse of the fold. The LAST separator wins, because a street
 * line may legitimately contain commas ("12, rue de Marseille, Tunis") while
 * the city — appended last — does not.
 *
 * No separator at all means the whole string is the address and the city is
 * unknown: that is what a pre-fold row or a hand-written value looks like, and
 * inventing a city out of the tail of a street name would be worse than
 * admitting we do not have one.
 */
export function splitAddress(customerAddress: string): {address: string; city: string} {
  if (typeof customerAddress !== 'string') return {address: '', city: ''};
  const index = customerAddress.lastIndexOf(ADDRESS_CITY_SEPARATOR);
  if (index === -1) return {address: customerAddress, city: ''};
  return {
    address: customerAddress.slice(0, index),
    city: customerAddress.slice(index + ADDRESS_CITY_SEPARATOR.length)
  };
}
