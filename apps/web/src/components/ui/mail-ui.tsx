'use client';

import React, { forwardRef, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const IconButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  ({ label, className, children, ...props }, ref) => (
    <button ref={ref} type="button" aria-label={label} title={label} className={cn('icon-button', className)} {...props}>{children}</button>
  ),
);
IconButton.displayName = 'IconButton';

export function Modal({ open, onClose, title, children, className }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[3px]" />
      <Dialog.Content aria-describedby={undefined} onOpenAutoFocus={() => { previousFocus.current = document.activeElement as HTMLElement; }} onCloseAutoFocus={(event) => { event.preventDefault(); previousFocus.current?.focus(); }} className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-popover shadow-2xl', className)}>
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-6">
          <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
          <Dialog.Close asChild><IconButton label={`Close ${title}`}><X size={19} /></IconButton></Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function Menu({ trigger, children, align = 'start' }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end' }) {
  return <Dropdown.Root><Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger><Dropdown.Portal>
    <Dropdown.Content align={align} sideOffset={8} className="z-[60] min-w-48 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-1.5 text-sm shadow-xl">
      {children}
    </Dropdown.Content>
  </Dropdown.Portal></Dropdown.Root>;
}
export function MenuItem({ children, onSelect, disabled }: { children: React.ReactNode; onSelect: () => void; disabled?: boolean }) {
  return <Dropdown.Item disabled={disabled} onSelect={onSelect} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 outline-none data-[highlighted]:bg-secondary data-[disabled]:opacity-50">{children}</Dropdown.Item>;
}
