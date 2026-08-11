import 'server-only';
import {prisma} from '@/lib/db';

const CATEGORY_SELECT = {select: {id: true, nameFr: true, nameAr: true}} as const;

export async function listProducts({
  search,
  includeArchived
}: {
  search?: string;
  includeArchived: boolean;
}) {
  return prisma.product.findMany({
    where: {
      ...(includeArchived ? {} : {archivedAt: null}),
      ...(search
        ? {
            OR: [
              {reference: {contains: search, mode: 'insensitive'}},
              {nameFr: {contains: search, mode: 'insensitive'}},
              {nameAr: {contains: search, mode: 'insensitive'}}
            ]
          }
        : {})
    },
    orderBy: {createdAt: 'desc'},
    include: {
      images: {orderBy: {sortOrder: 'asc'}},
      category: CATEGORY_SELECT,
      subCategory: CATEGORY_SELECT
    }
  });
}

export type ProductRow = Awaited<ReturnType<typeof listProducts>>[number];

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: {id},
    include: {
      images: {orderBy: {sortOrder: 'asc'}},
      category: CATEGORY_SELECT,
      subCategory: CATEGORY_SELECT
    }
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
