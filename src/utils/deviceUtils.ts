/**
 * Utility to reliably detect mobile / touch devices vs desktop / large screens.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const hasTouchScreen = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );

  const isSmallScreen = window.innerWidth <= 768;
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return (hasTouchScreen && isSmallScreen) || isMobileUserAgent;
}
