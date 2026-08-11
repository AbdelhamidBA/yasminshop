import 'server-only';
import {prisma} from '@/lib/db';

export async function listRootCategories(includeArchived: boolean) {
  const archivedFilter = includeArchived ? {} : {archivedAt: null};
  return prisma.category.findMany({
    where: {parentId: null, ...archivedFilter},
    orderBy: {nameFr: 'asc'},
    include: {
      children: {
        where: archivedFilter,
        orderBy: {nameFr: 'asc'},
        include: {_count: {select: {products: true}}}
      },
      _count: {select: {products: true}}
    }
  });
}

export type CategoryRow = Awaited<ReturnType<typeof listRootCategories>>[number];

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
