import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {pagingArgs} from './paging';

// Admin categories data access. The list is a TREE, so the paginated unit is
// the ROOT category: a page holds N roots and EVERY child of those roots
// travels with its parent. Paginating the flattened rows would slice a root
// away from its sub-categories — silently hiding them with no hint on screen —
// so `total` counts roots, and the count query reuses the exact same where
// clause as the rows query.

// Two mutually exclusive tabs (?archived=1 means archived rows ONLY), both
// counted in ROOTS — the unit the list pages by — so a tab number, the toolbar
// count and the footer range all speak the same language and cannot disagree.

/** The archived-state test applied to a single row, per tab. */
const rowState = (archived: boolean): Prisma.CategoryWhereInput =>
  archived ? {archivedAt: {not: null}} : {archivedAt: null};

/**
 * A root belongs to a tab when the root itself is in that state OR one of its
 * sub-categories is. The `some` half is what keeps a sub-category archived on
 * its own reachable: archiving a ROOT cascades to its children, but the per-row
 * action on a CHILD archives only that child and leaves its parent live — with
 * a plain `archivedAt: {not: null}` root filter that child would appear on
 * neither tab and could never be restored.
 */
const whereFor = (archived: boolean): Prisma.CategoryWhereInput => ({
  parentId: null,
  OR: [rowState(archived), {children: {some: rowState(archived)}}]
});

export type ListRootCategoriesParams = {
  archivedOnly: boolean;
  page: number;
  pageSize: number;
};

export async function listRootCategories(params: ListRootCategoriesParams) {
  const [categories, active, archived] = await prisma.$transaction([
    prisma.category.findMany({
      where: whereFor(params.archivedOnly),
      // nameFr is not unique, so an id tiebreak keeps the page boundary stable
      // between the two queries a page change makes.
      orderBy: [{nameFr: 'asc'}, {id: 'asc'}],
      include: {
        children: {
          // Only the children belonging to the open tab travel with the root.
          where: rowState(params.archivedOnly),
          orderBy: [{nameFr: 'asc'}, {id: 'asc'}],
          include: {_count: {select: {products: true}}}
        },
        _count: {select: {products: true}}
      },
      ...pagingArgs(params)
    }),
    prisma.category.count({where: whereFor(false)}),
    prisma.category.count({where: whereFor(true)})
  ]);

  const counts = {active, archived};
  return {categories, counts, total: params.archivedOnly ? archived : active};
}

export type CategoryRow = Awaited<ReturnType<typeof listRootCategories>>['categories'][number];

export async function listParentOptions() {
  return prisma.category.findMany({
    where: {parentId: null, archivedAt: null},
    orderBy: {nameFr: 'asc'},
    select: {id: true, nameFr: true, nameAr: true}
  });
}

export async function listCategoryTree() {
  return prisma.category.findMany({
    where: {parentId: null, archivedAt: null},
    orderBy: {nameFr: 'asc'},
    select: {
      id: true,
      nameFr: true,
      nameAr: true,
      children: {
        where: {archivedAt: null},
        orderBy: {nameFr: 'asc'},
        select: {id: true, nameFr: true, nameAr: true}
      }
    }
  });
}

export type CategoryTreeNode = Awaited<ReturnType<typeof listCategoryTree>>[number];
