import { useState, useEffect } from 'react';

interface DeviceType {
  isDesktop: boolean;
  isMobile: boolean;
  isTablet: boolean;
  screenWidth: number;
  platform: 'desktop' | 'mobile' | 'tablet';
}

export const useDeviceType = (): DeviceType => {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    const width = window.innerWidth;
    return {
      isDesktop: width >= 1024,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      screenWidth: width,
      platform: width >= 1024 ? 'desktop' : width >= 768 ? 'tablet' : 'mobile'
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setDeviceType({
        isDesktop: width >= 1024,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        screenWidth: width,
        platform: width >= 1024 ? 'desktop' : width >= 768 ? 'tablet' : 'mobile'
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
};

// Helper hook for desktop-first development
export const useDesktopFirst = () => {
  const { isDesktop, isMobile, isTablet } = useDeviceType();
  
  return {
    isDesktop,
    isMobile,
    isTablet,
    // Show desktop content by default, hide on mobile
    showDesktopFeatures: !isMobile,
    // Show mobile-specific content only on mobile
    showMobileFeatures: isMobile,
    // Show simplified version on mobile and tablet
    showSimplifiedView: isMobile || isTablet
  };
};