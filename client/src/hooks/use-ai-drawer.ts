import { useState, useEffect } from 'react';

const AI_DRAWER_STORAGE_KEY = 'zippicrm-ai-drawer-open';

export function useAIDrawer() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(AI_DRAWER_STORAGE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(AI_DRAWER_STORAGE_KEY, isOpen.toString());
  }, [isOpen]);

  const toggle = () => setIsOpen(!isOpen);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return {
    isOpen,
    toggle,
    open,
    close,
  };
}
