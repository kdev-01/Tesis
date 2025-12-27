import { useCallback, useEffect, useRef } from 'react';

export const useLiveAnnouncer = () => {
  const announcerRef = useRef(null);

  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    document.body.appendChild(el);
    announcerRef.current = el;

    return () => {
      document.body.removeChild(el);
    };
  }, []);

  const announce = useCallback((message) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = '';
      window.setTimeout(() => {
        announcerRef.current.textContent = message;
      }, 50);
    }
  }, []);

  return { announce };
};
