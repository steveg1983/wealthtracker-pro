import { createContext } from 'react';
import type { RealtimeSyncContextType } from './RealtimeSyncProvider.types';

export const RealtimeSyncContext = createContext<RealtimeSyncContextType | null>(null);
