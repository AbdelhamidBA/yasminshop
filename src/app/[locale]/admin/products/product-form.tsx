'use client';

import {useState, useTransition} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {Switch} from '@/components/ui/switch';
import {Textarea} from '@/components/ui/textarea';
import {Link, useRouter} from '@/i18n/navigation';
import {fieldErrorText} from '@/lib/field-error';
import {millimesToInput} from '@/lib/money';
import type {CategoryTreeNode} from '@/server/categories';
import type {ProductDetail} from '@/server/products';
import {createProduct, updateProduct} from './actions';
import {ImageUploader, type FormImage} from './image-uploader';

const NO_SUB_CATEGORY = 'none';

export function ProductForm({
  product,
  categories,
  readOnly
}: {
  product: ProductDetail | null;
  categories: CategoryTreeNode[];
  readOnly: boolean;
}) {
  const t = useTranslations('admin.productForm');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<FormImage[]>(
    product?.images.map((image) => ({url: image.url, sortOrder: image.sortOrder})) ?? []
  );
  const [categoryId, setCategoryId] = useState<string>(product?.categoryId ?? '');
  const [subCategoryId, setSubCategoryId] = useState<string>(
    product?.subCategoryId ?? NO_SUB_CATEGORY
  );
  const [featured, setFeatured] = useState<boolean>(product?.featured ?? false);

  const name = (node: {nameFr: string; nameAr: string}) =>
    locale === 'ar' ? node.nameAr : node.nameFr;

  const subCategories = categories.find((category) => category.id === categoryId)?.children ?? [];

  function errorText(code: string): string {
    return fieldErrorText(code, t);
  }

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{errorText(message)}</p>;
  }

  function submit(formData: FormData) {
    if (images.length === 0) {
      setFieldErrors({images: 'minOneImage'});
      toast.error(t('minOneImage'));
      return;
    }
    formData.set('images', JSON.stringify(images));
    formData.set('categoryId', categoryId);
    formData.set('subCategoryId', subCategoryId === NO_SUB_CATEGORY ? '' : subCategoryId);
    startTransition(async () => {
      const result = product
        ? await updateProduct(product.id, formData)
        : await createProduct(formData);
      if (result.ok) {
        toast.success(t('saved'));
        router.push('/admin/products');
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(errorText(result.error));
      }
    });
  }

  return (
    <form action={submit} className="grid gap-4 md:grid-cols-2">
      <fieldset disabled={readOnly || pending} className="contents">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reference">{t('reference')}</Label>
          <Input id="reference" name="reference" dir="ltr" defaultValue={product?.reference ?? ''} />
          {errorLine('reference')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameFr">{t('nameFr')}</Label>
          <Input id="nameFr" name="nameFr" defaultValue={product?.nameFr ?? ''} />
          {errorLine('nameFr')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameAr">{t('nameAr')}</Label>
          <Input id="nameAr" name="nameAr" dir="rtl" defaultValue={product?.nameAr ?? ''} />
          {errorLine('nameAr')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">{t('price')}</Label>
          <Input
            id="price"
            name="price"
            dir="ltr"
            defaultValue={product ? millimesToInput(product.priceMillimes) : ''}
          />
          {errorLine('price')}
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="descriptionFr">{t('descriptionFr')}</Label>
          <Textarea
            id="descriptionFr"
            name="descriptionFr"
            defaultValue={product?.descriptionFr ?? ''}
          />
          {errorLine('descriptionFr')}
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="descriptionAr">{t('descriptionAr')}</Label>
          <Textarea
            id="descriptionAr"
            name="descriptionAr"
            dir="rtl"
            defaultValue={product?.descriptionAr ?? ''}
          />
          {errorLine('descriptionAr')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="discountPct">{t('discountPct')}</Label>
          <Input
            id="discountPct"
            name="discountPct"
            type="number"
            min={0}
            max={100}
            defaultValue={product?.discountPct ?? 0}
          />
          {errorLine('discountPct')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity">{t('quantity')}</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={0}
            defaultValue={product?.quantity ?? 0}
          />
          {errorLine('quantity')}
        </div>
        <div className="flex items-center gap-3 md:col-span-2">
          <Switch
            id="featured"
            checked={featured}
            onCheckedChange={(checked) => setFeatured(checked)}
          />
          <Label htmlFor="featured">{t('featured')}</Label>
          <input type="hidden" name="featured" value={featured ? 'on' : ''} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t('category')}</Label>
          <Select
            value={categoryId || null}
            onValueChange={(value) => {
              setCategoryId(value ?? '');
              setSubCategoryId(NO_SUB_CATEGORY);
            }}
            items={categories.map((category) => ({value: category.id, label: name(category)}))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {name(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorLine('categoryId')}
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t('subCategory')}</Label>
          <Select
            value={subCategoryId}
            onValueChange={(value) => setSubCategoryId(value ?? NO_SUB_CATEGORY)}
            items={[
              {value: NO_SUB_CATEGORY, label: t('noSubCategory')},
              ...subCategories.map((sub) => ({value: sub.id, label: name(sub)}))
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SUB_CATEGORY}>{t('noSubCategory')}</SelectItem>
              {subCategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {name(sub)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorLine('subCategoryId')}
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label>{t('images')}</Label>
          <ImageUploader images={images} onChange={setImages} disabled={readOnly} />
          {errorLine('images')}
        </div>
        {readOnly ? (
          <p className="text-sm text-muted-foreground md:col-span-2">{t('readOnly')}</p>
        ) : (
          <div className="flex gap-3 md:col-span-2">
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
            <Button variant="outline" render={<Link href="/admin/products" />}>
              {t('cancel')}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
