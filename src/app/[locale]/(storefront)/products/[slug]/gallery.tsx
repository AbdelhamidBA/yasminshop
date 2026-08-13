'use client';

import {useTranslations} from 'next-intl';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel
} from '@/components/ui/carousel';
import {cn} from '@/lib/utils';

type GalleryImage = {id: string; url: string};

type GalleryProps = {
  images: GalleryImage[];
  // Localized product name — used for alt text and thumb aria-labels so the
  // gallery stays free of hardcoded copy in either locale.
  name: string;
};

// Karina-soft image frame shared by both gallery modes: rounded-lg over the
// muted pastel backdrop token (dark-safe), image covering it edge to edge.
const FRAME_CLASS =
  'overflow-hidden rounded-lg border bg-gradient-to-br from-muted/90 to-muted/40';
const IMAGE_CLASS = 'aspect-square w-full object-cover';

// Product image gallery (Phase 7). A product with >1 REAL image gets an
// embla-powered main carousel (swipe + RTL-aware arrows from the shared
// wrapper) with a SYNCED thumbnail strip: clicking a thumb scrolls to that
// slide, and swiping/arrowing the main strip moves the highlight. A single
// image stays a clean static frame — no carousel chrome, no fabricated
// thumbnails (Phase 6 honesty rule). Images are same-origin /api/uploads
// urls (plain <img>, like ProductCard).
export function Gallery({images, name}: GalleryProps) {
  const t = useTranslations('product');
  const list =
    images.length > 0 ? images : [{id: 'placeholder', url: '/placeholder-product.svg'}];

  if (list.length === 1) {
    return (
      <div className={FRAME_CLASS}>
        <img src={list[0].url} alt={name} className={IMAGE_CLASS} />
      </div>
    );
  }

  return (
    <Carousel aria-label={t('galleryLabel', {name})} opts={{loop: true}}>
      {/* The arrows anchor to this wrapper (main strip only) rather than the
          Carousel root, so the thumb strip below doesn't drag their vertical
          center below the image midline. */}
      <div className="relative">
        <CarouselContent className="-ms-4">
          {list.map((image, index) => (
            <CarouselItem key={image.id} className="ps-4">
              <div className={FRAME_CLASS}>
                <img
                  src={image.url}
                  alt={`${name} (${index + 1}/${list.length})`}
                  loading={index === 0 ? undefined : 'lazy'}
                  className={IMAGE_CLASS}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="absolute start-3 top-1/2 -translate-y-1/2" />
        <CarouselNext className="absolute end-3 top-1/2 -translate-y-1/2" />
      </div>
      <GalleryThumbs images={list} name={name} />
    </Carousel>
  );
}

// Thumbnail strip, synced through the carousel context (rendered inside
// <Carousel> only when the product genuinely has several images).
function GalleryThumbs({images, name}: {images: GalleryImage[]; name: string}) {
  const t = useTranslations('product');
  const {selectedIndex, scrollTo} = useCarousel();

  return (
    <div className="mt-3 grid grid-cols-4 gap-3">
      {images.map((image, index) => (
        <button
          key={image.id}
          type="button"
          onClick={() => scrollTo(index)}
          aria-label={t('galleryThumb', {name, index: index + 1, count: images.length})}
          aria-current={index === selectedIndex}
          className={cn(
            'overflow-hidden rounded-lg border bg-gradient-to-br from-muted/90 to-muted/40 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            index === selectedIndex
              ? 'border-foreground ring-1 ring-foreground'
              : 'hover:border-foreground/30'
          )}
        >
          <img src={image.url} alt="" loading="lazy" className={IMAGE_CLASS} />
        </button>
      ))}
    </div>
  );
}
