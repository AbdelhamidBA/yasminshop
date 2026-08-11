export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function ensureUniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>
): Promise<string> {
  const root = base || 'item';
  let candidate = root;
  for (let i = 2; await isTaken(candidate); i++) {
    candidate = `${root}-${i}`;
  }
  return candidate;
}
