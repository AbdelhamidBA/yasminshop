'use client';

import * as React from 'react';
import useEmblaCarousel, {type UseEmblaCarouselType} from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';

// Reusable embla wrapper (Phase 7, the shadcn carousel engine). Adaptations
// over stock shadcn: embla `direction` is wired from the active locale so AR
// swipes/arrows work in RTL; optional autoplay (pauses on hover, restarts
// after interaction) is disabled entirely under prefers-reduced-motion; arrow
// icons mirror with rtl:-scale-x-100; optional labelled dot indicators.
//
// Callers give the root an aria-label (it is a role="region" carousel) and
// size slides via CarouselItem `basis-*` classes. Slide gaps follow the
// LOGICAL -ms-*/ps-* pattern so they hold in RTL.

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];

type CarouselContextValue = {
  carouselRef: UseEmblaCarouselType[0];
  api: CarouselApi;
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  selectedIndex: number;
  snapCount: number;
};

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

// Exported for callers that render custom synced controls inside <Carousel>
// (e.g. the product gallery's thumbnail strip: click → scrollTo, active thumb
// highlighted from selectedIndex).
function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) throw new Error('useCarousel must be used within <Carousel>');
  return context;
}

type CarouselProps = React.ComponentProps<'div'> & {
  opts?: CarouselOptions;
  /** Autoplay delay in ms; omit for a manual carousel. */
  autoplayDelay?: number;
  /** Region label — required so every carousel is announced meaningfully. */
  'aria-label': string;
};

function Carousel({opts, autoplayDelay, className, children, ...props}: CarouselProps) {
  const locale = useLocale();
  // Read once per mount: users who need reduced motion get a fully manual
  // carousel (arrows/dots/swipe still work). SSR renders without plugins in
  // both cases, so this never causes a hydration mismatch.
  const [reducedMotion] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const plugins = React.useMemo(
    () =>
      autoplayDelay !== undefined && !reducedMotion
        ? [
            Autoplay({
              delay: autoplayDelay,
              // Pause while hovered, resume on leave; arrow/drag interactions
              // reset the timer instead of killing autoplay for good.
              stopOnMouseEnter: true,
              stopOnInteraction: false,
              stopOnFocusIn: true
            })
          ]
        : [],
    [autoplayDelay, reducedMotion]
  );
  const [carouselRef, api] = useEmblaCarousel(
    {...opts, direction: locale === 'ar' ? 'rtl' : 'ltr'},
    plugins
  );

  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [snapCount, setSnapCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
      setSelectedIndex(api.selectedScrollSnap());
    };
    const onReInit = () => {
      setSnapCount(api.scrollSnapList().length);
      onSelect();
    };
    onReInit();
    api.on('select', onSelect).on('reInit', onReInit);
    return () => {
      api.off('select', onSelect).off('reInit', onReInit);
    };
  }, [api]);

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);
  const scrollTo = React.useCallback((index: number) => api?.scrollTo(index), [api]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api,
        scrollPrev,
        scrollNext,
        scrollTo,
        canScrollPrev,
        canScrollNext,
        selectedIndex,
        snapCount
      }}
    >
      <div
        role="region"
        aria-roledescription="carousel"
        className={cn('relative', className)}
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({className, ...props}: React.ComponentProps<'div'>) {
  const {carouselRef} = useCarousel();
  return (
    <div ref={carouselRef} className="overflow-hidden">
      {/* touch-pan-y keeps vertical page scrolling alive over the strip. */}
      <div className={cn('flex touch-pan-y', className)} {...props} />
    </div>
  );
}

function CarouselItem({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      className={cn('min-w-0 shrink-0 grow-0 basis-full', className)}
      {...props}
    />
  );
}

function CarouselPrevious({className, ...props}: React.ComponentProps<typeof Button>) {
  const t = useTranslations('carousel');
  const {scrollPrev, canScrollPrev} = useCarousel();
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label={t('previous')}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      className={cn('rounded-full bg-background/90 shadow-sm backdrop-blur', className)}
      {...props}
    >
      <ChevronLeft className="rtl:-scale-x-100" aria-hidden="true" />
    </Button>
  );
}

function CarouselNext({className, ...props}: React.ComponentProps<typeof Button>) {
  const t = useTranslations('carousel');
  const {scrollNext, canScrollNext} = useCarousel();
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label={t('next')}
      disabled={!canScrollNext}
      onClick={scrollNext}
      className={cn('rounded-full bg-background/90 shadow-sm backdrop-blur', className)}
      {...props}
    >
      <ChevronRight className="rtl:-scale-x-100" aria-hidden="true" />
    </Button>
  );
}

function CarouselDots({className, ...props}: React.ComponentProps<'div'>) {
  const t = useTranslations('carousel');
  const {snapCount, selectedIndex, scrollTo} = useCarousel();
  // Rendered only after embla init (client-side); pointless for one slide.
  if (snapCount <= 1) return null;
  return (
    <div className={cn('flex items-center justify-center gap-2', className)} {...props}>
      {Array.from({length: snapCount}, (_, index) => (
        <button
          key={index}
          type="button"
          aria-label={t('goToSlide', {index: index + 1})}
          aria-current={index === selectedIndex ? 'true' : undefined}
          onClick={() => scrollTo(index)}
          className={cn(
            'h-2 rounded-full transition-all',
            index === selectedIndex
              ? 'w-6 bg-primary'
              : 'w-2 bg-foreground/25 hover:bg-foreground/50'
          )}
        />
      ))}
    </div>
  );
}

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  CarouselDots,
  useCarousel,
  type CarouselApi
};
