'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'c', desc: 'Compose a new message' },
    { key: '/', desc: 'Focus global search input' },
    { key: 'j / k', desc: 'Navigate to next / previous message' },
    { key: 'e', desc: 'Archive selected message(s)' },
    { key: '#', desc: 'Delete selected message(s)' },
    { key: 's', desc: 'Toggle star on selected message' },
    { key: 'r', desc: 'Reply to sender' },
    { key: 'a', desc: 'Reply all' },
    { key: 'f', desc: 'Forward message' },
    { key: 'g i', desc: 'Go to Inbox' },
    { key: 'Esc', desc: 'Return to message list / Close modal' },
    { key: '?', desc: 'Show / hide this shortcuts cheat-sheet' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-popover border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Keyboard className="w-5 h-5 text-primary" />
            <span>Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between text-xs py-1.5 border-b border-border/40"
            >
              <span className="text-muted-foreground">{sc.desc}</span>
              <kbd className="px-2 py-1 rounded bg-secondary font-mono font-semibold text-foreground border border-border/60 shadow-xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono">Esc</kbd> or click outside to dismiss.
        </div>
      </div>
    </div>
  );
}
