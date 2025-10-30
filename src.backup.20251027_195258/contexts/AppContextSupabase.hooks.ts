import { useContext } from 'react';
import { AppContext } from './AppContextSupabase.context';
import type { AppContextType } from './AppContextSupabase.types';
import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('AppContextSupabase');

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    logger.error('useApp called outside of AppProvider');
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
