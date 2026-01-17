"use client"

import { useEffect, useCallback } from 'react';

type KeyboardHandler = (event: KeyboardEvent) => void;

interface UseKeyboardOptions {
  key: string;
  ctrlOrMeta?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
}

export function useKeyboard(
  handler: KeyboardHandler,
  options: UseKeyboardOptions
) {
  const { key, ctrlOrMeta = false, shift = false, alt = false, preventDefault = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const matchesMeta = ctrlOrMeta ? (event.metaKey || event.ctrlKey) : true;
      const matchesShift = shift ? event.shiftKey : !event.shiftKey;
      const matchesAlt = alt ? event.altKey : !event.altKey;
      const matchesKey = event.key.toLowerCase() === key.toLowerCase();

      if (matchesKey && matchesMeta && matchesShift && matchesAlt) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler(event);
      }
    },
    [handler, key, ctrlOrMeta, shift, alt, preventDefault]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
