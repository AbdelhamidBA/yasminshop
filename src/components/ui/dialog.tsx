"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"

// Admin-only surface (grep: every import of this file lives under
// src/app/[locale]/admin — the storefront drawer uses sheet.tsx), so it is
// styled to the Minimal UI language: a borderless rounded-2xl paper sheet that
// floats on a soft dark wash, 24px padding, a bold title, comfortable field
// rhythm and a right-aligned footer (quiet cancel + solid confirm).
//
// The popup PORTALS to <body>, outside the admin subtree, so it carries
// `theme-minimal` itself — same precedent as the storefront's drawer/menus.
// Field sizing is set here rather than at each call site: the shared Input /
// Select / Textarea primitives are storefront-owned and must not be edited, so
// their dialog-only comfortable height is applied through data-slot child
// selectors (higher specificity than the primitive's own utility, so it wins
// regardless of class order).
const DIALOG_FIELD_SIZING = [
  "[&_[data-slot=input]]:h-10 [&_[data-slot=input]]:px-3",
  "[&_[data-slot=textarea]]:min-h-20 [&_[data-slot=textarea]]:px-3 [&_[data-slot=textarea]]:py-2.5",
  "[&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:ps-3",
].join(" ")

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/45 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  const t = useTranslations("common")

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "theme-minimal fixed top-1/2 start-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl bg-popover p-6 text-sm text-popover-foreground shadow-float duration-150 outline-none rtl:translate-x-1/2 sm:w-full sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          DIALOG_FIELD_SIZING,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <button
                type="button"
                className="absolute top-4 end-4 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-(--admin-neutral-soft) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            <XIcon className="size-4" />
            <span className="sr-only">{t("close")}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 pe-8", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-lg leading-6 font-bold tracking-[-0.01em]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
