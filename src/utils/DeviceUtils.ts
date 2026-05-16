export const DeviceUtils = {
  isMobile: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const userAgent = window.navigator.userAgent || window.navigator.vendor || (window as any).opera;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Regular expression for common mobile devices
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    
    return mobileRegex.test(userAgent) || (isTouch && window.innerWidth <= 1024);
  }
};
