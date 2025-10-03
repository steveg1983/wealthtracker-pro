import { createContext } from 'react';

export interface LayoutContextType {
  isWideView: boolean;
  setIsWideView: (value: boolean) => void;
}

export const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

