'use client';

import {useRef, useState} from 'react';
import {ArrowDown, ArrowUp, ImagePlus, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';

export type FormImage = {url: string; sortOrder: number};

export function ImageUploader({
  images,
  onChange,
  disabled
}: {
  images: FormImage[];
  onChange: (images: FormImage[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('admin.productForm');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const renumber = (list: FormImage[]) => list.map((image, index) => ({...image, sortOrder: index}));

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/uploads', {method: 'POST', body});
      if (!response.ok) throw new Error('upload');
      const {url} = (await response.json()) as {url: string};
      onChange(renumber([...images, {url, sortOrder: images.length}]));
    } catch {
      // The hint names exactly what /api/uploads accepts (lib/uploads.ts):
      // the four image types and MAX_UPLOAD_BYTES.
      toast.error(t('uploadFailed'), {description: t('uploadHint')});
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
  }

  return (
    <ul className="flex flex-wrap gap-3">
      {images.map((image, index) => (
        <li
          key={image.url}
          className="relative size-28 overflow-hidden rounded-xl bg-(--admin-neutral-soft)"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" className="size-full object-cover" />
          {!disabled && (
            // Always rendered (never hover-only) so the reorder/remove controls
            // stay keyboard reachable and visibly focusable.
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-card p-1 text-foreground">
              <Button type="button" size="icon-xs" variant="ghost" aria-label={t('moveUp')}
                onClick={() => move(index, -1)} disabled={index === 0}>
                <ArrowUp />
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label={t('moveDown')}
                onClick={() => move(index, 1)} disabled={index === images.length - 1}>
                <ArrowDown />
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label={t('removeImage')}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(renumber(images.filter((_, i) => i !== index)))}>
                <X />
              </Button>
            </div>
          )}
        </li>
      ))}
      {!disabled && (
        <li>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={uploading}
            className="size-28 flex-col gap-1.5 rounded-xl bg-(--admin-neutral-soft) px-2 text-center text-xs leading-tight font-semibold whitespace-normal text-muted-foreground hover:bg-(--admin-primary-soft) hover:text-(--admin-primary-dark)"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-5" />
            {uploading ? t('uploading') : t('addImage')}
          </Button>
        </li>
      )}
    </ul>
  );
}
