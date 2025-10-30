import { createContext } from 'react';
import type { ToastContextType } from './ToastContext.types';

export const ToastContext = createContext<ToastContextType | undefined>(undefined);
