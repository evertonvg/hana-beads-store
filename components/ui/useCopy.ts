"use client";

import { useEffect, useRef, useState } from "react";

export const COPY_RESET_MS = 2500;

/** Copies text to the clipboard. A clipboard failure still flips `copied` (as in the design). */
export function useCopy(value: string, resetMs: number = COPY_RESET_MS) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard unavailable or denied: the label still changes and the field stays selectable.
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), resetMs);
  }

  return { copied, copy: () => void copy() };
}
