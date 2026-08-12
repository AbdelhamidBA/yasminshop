import {getTranslations} from 'next-intl/server';
import {Eyebrow} from '@/components/storefront/brand';
import {cn} from '@/lib/utils';

// THE ORDER LIFECYCLE BAND — the homepage's signature moment.
//
// Not a "why choose us" strip: these are the three REAL stages an order
// passes through in this system, mirroring the OrderStatus state machine
// (PENDING -> CONFIRMED -> DELIVERED; CANCELED is an exit, not a stage, so it
// is not shown). Numbering is honest here precisely because it genuinely is a
// sequence — a first-time cash-on-delivery buyer needs to know what happens
// after they click, before they hand money to a stranger at their door.
//
// The enum names themselves are deliberately NOT printed: "PENDING" is
// internal jargon, and the copy in messages/*.json states the same three
// stages in the customer's words. No delivery times, no guarantees — the owner
// has made none.
//
// Vernacular: ONE sheet of paper, not three floating cards. A dotted rule is
// torn across the sheet — the same `border-dotted` leader SlipRow draws on the
// checkout receipt, so the band and the slip read as printed by the same shop
// — and the three numbered stages sit on it as ruled tabs, numbers in the
// utility face.
//
// No Stamp here, deliberately. The cachet is spent "only where hesitation
// peaks" (design-language.md) — that is the product page's buy panel, not a
// homepage the visitor is still browsing. A stamp on top of a full band would
// be accumulation, and the promise it carries is already written out in full
// in stage 03's own two sentences.
//
// Colour is brown ink on beige paper, no gold at all: gold's 5-10% budget
// belongs to the CTAs and the cart, and this band must never out-shout the
// products it sits above.

export async function OrderLifecycle({isAr}: {isAr: boolean}) {
  const t = await getTranslations('home.lifecycle');

  const stages = [
    // n is a printed form's field number, not a translated string — the
    // storefront sets every figure (prices included) in Western digits.
    {n: '01', title: t('step1Title'), body: t('step1Body')},
    {n: '02', title: t('step2Title'), body: t('step2Body')},
    {n: '03', title: t('step3Title'), body: t('step3Body')}
  ];

  return (
    // Full-bleed beige strip, hairline-ruled top and bottom: one sheet laid
    // across the page between the category pills and the first product grid
    // (never at the foot of the page — the brief forbids a promotional section
    // between the last product section and the footer).
    <section
      aria-labelledby="home-lifecycle-title"
      className="mb-12 border-y bg-secondary sm:mb-16"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
        {/* Display role, start-aligned: a document's heading, not a centered
            marketing banner. */}
        <h2
          id="home-lifecycle-title"
          className="max-w-[20ch] text-2xl leading-[1.1] font-extrabold text-balance sm:text-3xl lg:text-4xl"
        >
          {t('title')}
        </h2>

        <div className="relative mt-9 sm:mt-11">
          {/* THE PERFORATION. From md it is one rule torn the full width of
              the sheet, passing behind the three tabs at their exact centre
              (tab is size-10, so its centre is top-5). It runs on past the
              last tab to the edge of the sheet: a tear line, not an arrow —
              nothing here suggests a fourth stage. Logical inset properties,
              so it needs no mirroring in Arabic. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute start-0 end-0 top-5 hidden border-t border-dotted border-foreground/30 md:block"
          />

          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {stages.map((stage, index) => (
              // Stacked, the stage keeps a gutter the width of its tab so the
              // vertical perforation runs down clear paper instead of through
              // the sentences. From md the gutter collapses and the tab
              // returns to the flow, on top of the horizontal rule.
              <li key={stage.n} className="relative ps-14 md:ps-0">
                {/* Stacked: the perforation turns vertical and joins this
                    tab's foot to the next tab's head (gap-10 = 40px, so
                    -bottom-10 lands exactly on it). The last stage has none —
                    the sequence ends there. */}
                {index < stages.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute start-[19.5px] top-10 -bottom-10 border-s border-dotted border-foreground/30 md:hidden"
                  />
                )}

                {/* The tab: a ruled box, brown ink, number in the utility
                    face. Filled with the sheet's own colour so the rule
                    disappears behind it. rounded-lg per the brief — circles
                    are reserved for count bubbles and status dots, and a
                    circled number is the exact cliché this band avoids.
                    Stays `relative` from md so it paints over the rule. */}
                <span className="absolute start-0 top-0 flex size-10 items-center justify-center rounded-lg border border-current/45 bg-secondary text-(--brand-brown) md:relative md:mb-5">
                  <Eyebrow
                    tracked={!isAr}
                    className={cn(
                      'font-semibold tabular-nums',
                      // Cancels the trailing letter-space so the pair sits
                      // optically centred in the box (FR only — Arabic is
                      // untracked, and these are digits either way).
                      !isAr && '-me-[0.18em]'
                    )}
                  >
                    {stage.n}
                  </Eyebrow>
                </span>

                {/* mt-2.5 optically centres the title against the tab beside
                    it when stacked; from md the tab's own mb-5 sets the gap. */}
                <h3 className="mt-2.5 text-[17px] leading-tight font-extrabold text-balance md:mt-0">
                  {stage.title}
                </h3>
                <p className="mt-2.5 max-w-[42ch] text-sm leading-[1.75] text-foreground/80">
                  {stage.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
