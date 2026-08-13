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

export type ListRootCategoriesParams = {
  includeArchived: boolean;
  page: number;
  pageSize: number;
};

export async function listRootCategories(params: ListRootCategoriesParams) {
  const archivedFilter = params.includeArchived ? {} : {archivedAt: null};
  const where: Prisma.CategoryWhereInput = {parentId: null, ...archivedFilter};
  const [categories, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      // nameFr is not unique, so an id tiebreak keeps the page boundary stable
      // between the two queries a page change makes.
      orderBy: [{nameFr: 'asc'}, {id: 'asc'}],
      include: {
        children: {
          where: archivedFilter,
          orderBy: [{nameFr: 'asc'}, {id: 'asc'}],
          include: {_count: {select: {products: true}}}
        },
        _count: {select: {products: true}}
      },
      ...pagingArgs(params)
    }),
    prisma.category.count({where})
  ]);
  return {categories, total};
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
