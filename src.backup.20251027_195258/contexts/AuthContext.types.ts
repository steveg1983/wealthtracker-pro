import type { AuthUser } from '../services/authService';

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  securityScore: number;
  securityRecommendations: string[];
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
