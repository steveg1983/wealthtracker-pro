import { lazyLogger as logger } from './serviceFactory';

export const merchantLogoService = {
  getMerchantLogo: (merchantName: string): string | null => {
    logger.debug('Getting merchant logo for:', merchantName);
    // Stub implementation
    return null;
  },

  clearCache: () => {
    logger.debug('Clearing merchant logo cache');
  }
};