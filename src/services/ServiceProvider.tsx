import { createContext, useContext, type ReactNode } from 'react';
import type { ILoggingService } from './interfaces/ILoggingService';
import type { IStorageService } from './interfaces/IStorageService';
import type { IAuthService } from './interfaces/IAuthService';

/**
 * Service Provider
 * Provides dependency injection for services to break circular dependencies
 * and reduce bundle size by allowing lazy loading of service implementations
 */

interface Services {
  logger: ILoggingService;
  storage: IStorageService;
  auth: IAuthService | null; // Can be null until initialized
}

const ServiceContext = createContext<Services | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  services?: Partial<Services>; // Allow override for testing
}

// Default no-op implementations to prevent errors
const defaultLogger: ILoggingService = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trackPerformance: () => {},
  trackActivity: () => {}
};

const defaultStorage: IStorageService = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  hasItem: () => false
};

export const ServiceProvider = ({ children, services }: ServiceProviderProps) => {
  // Use provided services or defaults
  const contextValue: Services = {
    logger: services?.logger || defaultLogger,
    storage: services?.storage || defaultStorage,
    auth: services?.auth || null
  };

  return (
    <ServiceContext.Provider value={contextValue}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useServices = () => {
  const services = useContext(ServiceContext);
  if (!services) {
    throw new Error('useServices must be used within ServiceProvider');
  }
  return services;
};

// Individual hooks for specific services
export const useLogger = () => {
  const { logger } = useServices();
  return logger;
};

export const useStorage = () => {
  const { storage } = useServices();
  return storage;
};

export const useAuth = () => {
  const { auth } = useServices();
  return auth;
};