"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

// Base UI Dialog styled as a slide-over sheet (Phase 7). `side` is LOGICAL:
// "end" slides in from the inline-end edge (right in LTR, left in RTL) and
// "start" from the inline-start edge. Positioning uses logical start-0/end-0;
// the animation utilities are physical (tw-animate-css), so rtl: overrides
// flip them to keep the motion attached to the same logical edge — the same
// pattern as the dialog's rtl:translate-x fix.

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetContent({
  side = "end",
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props & {
  side?: "start" | "end"
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 isolate z-50 bg-black/20 duration-300 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-full max-w-sm flex-col bg-background text-sm text-foreground shadow-xl ring-1 ring-foreground/10 outline-none duration-300 data-open:animate-in data-closed:animate-out",
          side === "end"
            ? "end-0 rounded-s-lg data-open:slide-in-from-right data-closed:slide-out-to-right rtl:data-open:slide-in-from-left rtl:data-closed:slide-out-to-left"
            : "start-0 rounded-e-lg data-open:slide-in-from-left data-closed:slide-out-to-left rtl:data-open:slide-in-from-right rtl:data-closed:slide-out-to-right",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export { Sheet, SheetClose, SheetContent, SheetTrigger }
