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
      toast.error(t('uploadFailed'));
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
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-3">
        {images.map((image, index) => (
          <li key={image.url} className="relative rounded-md border p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="size-24 rounded object-cover" />
            {!disabled && (
              <div className="mt-1 flex justify-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label={t('moveUp')}
                  onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowUp className="size-3" />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label={t('moveDown')}
                  onClick={() => move(index, 1)} disabled={index === images.length - 1}>
                  <ArrowDown className="size-3" />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label={t('removeImage')}
                  onClick={() => onChange(renumber(images.filter((_, i) => i !== index)))}>
                  <X className="size-3" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div>
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
          <Button type="button" variant="outline" disabled={uploading}
            onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" /> {uploading ? t('uploading') : t('addImage')}
          </Button>
        </div>
      )}
    </div>
  );
}
