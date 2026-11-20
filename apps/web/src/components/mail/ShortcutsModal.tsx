"use client";

import React from "react";
import { Modal } from "@/components/ui/mail-ui";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "c", desc: "Compose a new message" },
    { key: "/", desc: "Focus global search input" },
    { key: "j / k", desc: "Navigate to next / previous message" },
    { key: "e", desc: "Archive selected message(s)" },
    { key: "#", desc: "Delete selected message(s)" },
    { key: "s", desc: "Toggle star on selected message" },
    { key: "r", desc: "Reply to sender" },
    { key: "a", desc: "Reply all" },
    { key: "f", desc: "Forward message" },
    { key: "g i", desc: "Go to Inbox" },
    { key: "Esc", desc: "Return to message list / Close modal" },
    { key: "?", desc: "Show / hide this shortcuts cheat-sheet" },
  ];

  return (
    <Modal open={isOpen} onClose={onClose} title="Keyboard Shortcuts">
      <div className="p-6">
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
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono">
            Esc
          </kbd>{" "}
          or click outside to dismiss.
        </div>
      </div>
    </Modal>
  );
}
