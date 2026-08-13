'use client';

import {useState, useTransition} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {
  adminControl, adminPrimaryAction, adminQuietAction, adminTextarea, Field, FormActions,
  FormSection, SoftNote
} from '@/components/admin/form';
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
  // React 19 resets an uncontrolled <form action={...}> once the action
  // settles — including when it FAILS validation, which wiped everything the
  // user had typed. Keep the submitted text values and replay them as the new
  // defaults; `entryKey` remounts just those inputs so the new defaults take
  // effect. Only the text inputs are keyed: the image list, selects and the
  // featured switch are React state and already survive.
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [entryKey, setEntryKey] = useState(0);
  const initial = (field: string, fallback: string | number | null | undefined) =>
    entered[field] ?? (fallback === null || fallback === undefined ? '' : String(fallback));
  const [images, setImages] = useState<FormImage[]>(
    product?.images.map((image) => ({url: image.url, sortOrder: image.sortOrder})) ?? []
  );
  const [categoryId, setCategoryId] = useState<string>(product?.categoryId ?? '');
  const [subCategoryId, setSubCategoryId] = useState<string>(
    product?.subCategoryId ?? NO_SUB_CATEGORY
  );
  const [featured, setFeatured] = useState<boolean>(product?.featured ?? false);

  const name = (node: {nameFr: string}) => node.nameFr;

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
    // Snapshot what was typed BEFORE any early return: React resets the form
    // as soon as this action returns, whatever the outcome, so every failure
    // path has to put the values back — not just the server-rejected one.
    const typed: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') typed[key] = value;
    }
    const restoreTypedValues = () => {
      setEntered(typed);
      setEntryKey((key) => key + 1);
    };

    if (images.length === 0) {
      setFieldErrors({images: 'minOneImage'});
      toast.error(t('minOneImage'));
      restoreTypedValues();
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
        restoreTypedValues();
        toast.error(errorText(result.error));
      }
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-6">
      {/* `contents` keeps the fieldset's disabled semantics while letting the
          section cards be the form's own flex children. */}
      <fieldset disabled={readOnly || pending} className="contents">
        <FormSection title={t('sectionInfo')}>
          <Field label={t('reference')} htmlFor="reference" error={errorLine('reference')}>
            <Input
              id="reference"
              name="reference"
              dir="ltr"
              className={adminControl}
              key={`reference-${entryKey}`}
              defaultValue={initial('reference', product?.reference)}
            />
          </Field>
          {/* Brand is FREE TEXT and OPTIONAL — the schema trims it and stores
              NULL for a blank, so clearing the field really clears the column. */}
          <Field
            label={t('brand')}
            htmlFor="brand"
            hint={t('brandHint')}
            error={errorLine('brand')}
          >
            <Input
              id="brand"
              name="brand"
              maxLength={80}
              className={adminControl}
              key={`brand-${entryKey}`}
              defaultValue={initial('brand', product?.brand)}
            />
          </Field>
          <Field
            label={t('nameFr')}
            htmlFor="nameFr"
            error={errorLine('nameFr')}
            className="sm:col-span-2"
          >
            <Input
              id="nameFr"
              name="nameFr"
              className={adminControl}
              key={`nameFr-${entryKey}`}
              defaultValue={initial('nameFr', product?.nameFr)}
            />
          </Field>
          <Field
            label={t('descriptionFr')}
            htmlFor="descriptionFr"
            error={errorLine('descriptionFr')}
            className="sm:col-span-2"
          >
            <Textarea
              id="descriptionFr"
              name="descriptionFr"
              className={adminTextarea}
              key={`descriptionFr-${entryKey}`}
              defaultValue={initial('descriptionFr', product?.descriptionFr)}
            />
          </Field>
        </FormSection>

        <FormSection title={t('sectionPricing')} bodyClassName="sm:grid-cols-3">
          <Field label={t('price')} htmlFor="price" error={errorLine('price')}>
            <Input
              id="price"
              name="price"
              dir="ltr"
              className={adminControl}
              key={`price-${entryKey}`}
              defaultValue={initial('price', product ? millimesToInput(product.priceMillimes) : '')}
            />
          </Field>
          <Field label={t('discountPct')} htmlFor="discountPct" error={errorLine('discountPct')}>
            <Input
              id="discountPct"
              name="discountPct"
              type="number"
              min={0}
              max={100}
              className={adminControl}
              key={`discountPct-${entryKey}`}
              defaultValue={initial('discountPct', product?.discountPct ?? 0)}
            />
          </Field>
          <Field label={t('quantity')} htmlFor="quantity" error={errorLine('quantity')}>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={0}
              className={adminControl}
              key={`quantity-${entryKey}`}
              defaultValue={initial('quantity', product?.quantity ?? 0)}
            />
          </Field>
        </FormSection>

        {/* Category MUST stay the first combobox in DOM order — the catalog
            e2e picks it by position (category first, sub-category second). */}
        <FormSection title={t('sectionOrganization')}>
          <Field label={t('category')} error={errorLine('categoryId')}>
            <Select
              value={categoryId || null}
              onValueChange={(value) => {
                setCategoryId(value ?? '');
                setSubCategoryId(NO_SUB_CATEGORY);
              }}
              items={categories.map((category) => ({value: category.id, label: name(category)}))}
            >
              <SelectTrigger className={`w-full ${adminControl}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="theme-minimal">
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {name(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('subCategory')} error={errorLine('subCategoryId')}>
            <Select
              value={subCategoryId}
              onValueChange={(value) => setSubCategoryId(value ?? NO_SUB_CATEGORY)}
              items={[
                {value: NO_SUB_CATEGORY, label: t('noSubCategory')},
                ...subCategories.map((sub) => ({value: sub.id, label: name(sub)}))
              ]}
            >
              <SelectTrigger className={`w-full ${adminControl}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="theme-minimal">
                <SelectItem value={NO_SUB_CATEGORY}>{t('noSubCategory')}</SelectItem>
                {subCategories.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {name(sub)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-3 rounded-xl bg-(--admin-neutral-soft) px-4 py-3 sm:col-span-2">
            <Switch
              id="featured"
              checked={featured}
              onCheckedChange={(checked) => setFeatured(checked)}
            />
            <Label htmlFor="featured" className="text-sm font-medium">
              {t('featured')}
            </Label>
            <input type="hidden" name="featured" value={featured ? 'on' : ''} />
          </div>
        </FormSection>

        {/* The formats/size hint now lives INSIDE the drop zone, next to the
            control it constrains; the card description carries the one rule
            that is not obvious — image 1 is the one the shop displays. */}
        <FormSection
          title={t('images')}
          description={t('imagesHelp')}
          bodyClassName="sm:grid-cols-1"
        >
          <Field error={errorLine('images')}>
            <ImageUploader images={images} onChange={setImages} disabled={readOnly} />
          </Field>
        </FormSection>

        {readOnly ? (
          <SoftNote>{t('readOnly')}</SoftNote>
        ) : (
          <FormActions>
            <Button
              variant="ghost"
              className={adminQuietAction}
              render={<Link href="/admin/products" />}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" className={adminPrimaryAction} disabled={pending}>
              {t('save')}
            </Button>
          </FormActions>
        )}
      </fieldset>
    </form>
  );
}
