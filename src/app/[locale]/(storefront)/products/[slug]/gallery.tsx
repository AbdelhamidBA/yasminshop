'use client';

import {useState} from 'react';
import {cn} from '@/lib/utils';

type GalleryImage = {id: string; url: string};

type GalleryProps = {
  images: GalleryImage[];
  // Localized product name — used for alt text and thumb aria-labels so the
  // gallery stays free of hardcoded copy in either locale.
  name: string;
};

// Product image gallery: main image + thumbnail strip underneath (reference
// layout), with the selected thumb outlined. Pure client-side selected index;
// images are same-origin /api/uploads urls (plain <img>, like ProductCard).
export function Gallery({images, name}: GalleryProps) {
  const list =
    images.length > 0 ? images : [{id: 'placeholder', url: '/placeholder-product.svg'}];
  const [selected, setSelected] = useState(0);
  // Clamp defensively in case the images prop ever shrinks across renders.
  const currentIndex = Math.min(selected, list.length - 1);

  return (
    <div>
      <img
        src={list[currentIndex].url}
        alt={name}
        className="aspect-square w-full rounded-lg border bg-muted object-cover"
      />
      <div className="mt-3 grid grid-cols-4 gap-3">
        {list.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelected(index)}
            aria-label={`${name} ${index + 1}/${list.length}`}
            aria-current={index === currentIndex}
            className={cn(
              'overflow-hidden rounded-lg border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              index === currentIndex
                ? 'border-primary ring-1 ring-primary'
                : 'hover:border-foreground/30'
            )}
          >
            <img
              src={image.url}
              alt=""
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
