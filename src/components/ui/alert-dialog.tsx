"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Admin-only surface (grep: every import of this file lives under
// src/app/[locale]/admin), styled to match dialog.tsx: borderless rounded-2xl
// paper on a soft dark wash, 24px padding, bold title, muted body, and a
// right-aligned footer (quiet outline cancel + solid confirm). The popup
// portals to <body>, outside the admin subtree, so it carries `theme-minimal`
// itself — same precedent as the storefront's portalled surfaces.

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/45 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: "default" | "sm"
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "group/alert-dialog-content theme-minimal fixed top-1/2 start-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl bg-popover p-6 text-popover-foreground shadow-float duration-150 outline-none rtl:translate-x-1/2 sm:w-full data-[size=default]:sm:max-w-sm data-[size=sm]:sm:max-w-xs data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col items-start gap-2 text-start", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

/** Tinted rounded square for a confirm dialog's icon (the IconBox idiom). */
function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-1 inline-flex size-11 items-center justify-center rounded-2xl bg-(--admin-neutral-soft) text-muted-foreground *:[svg:not([class*='size-'])]:size-5",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "font-heading text-lg leading-6 font-bold tracking-[-0.01em]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "text-sm text-pretty text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

// Every confirm dialog in the dashboard is destructive today (six archive
// flows + cancel-order), and Minimal states a destructive confirmation with a
// SOLID error button — so that is the default here rather than a prop repeated
// at seven call sites. A future non-destructive confirm passes variant="default".
// The shared button.tsx destructive variant is a soft tint (storefront-owned,
// not editable), so the solid fill is applied on top, tokens only.
function AlertDialogAction({
  className,
  variant = "destructive",
  size = "lg",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-action"
      variant={variant}
      size={size}
      className={cn(
        "px-4",
        variant === "destructive" &&
          "bg-destructive text-primary-foreground hover:bg-destructive/85 dark:bg-destructive dark:hover:bg-destructive/85",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "lg",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      // px-4 goes on the Button itself so its internal tailwind-merge resolves
      // it against the size variant's own padding.
      render={<Button variant={variant} size={size} className="px-4" />}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
