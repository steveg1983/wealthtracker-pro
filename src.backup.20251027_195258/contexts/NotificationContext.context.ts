import { createContext } from 'react';
import type { NotificationContextType } from './NotificationContext.types';

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
