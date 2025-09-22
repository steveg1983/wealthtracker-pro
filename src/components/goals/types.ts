import type { Goal } from '../../types';

export interface GoalProjection {
  monthsToGoal: number;
  requiredMonthlySaving: number;
  currentProgress: number;
  projectedDate: Date;
  onTrack: boolean;
  surplus: number;
}

export interface GoalCategory {
  value: string;
  label: string;
  icon: any; // Icon component
}

export const GOAL_CATEGORIES: GoalCategory[] = [
  { value: 'home', label: 'Home', icon: 'HomeIcon' },
  { value: 'car', label: 'Car', icon: 'CarIcon' },
  { value: 'education', label: 'Education', icon: 'GraduationCapIcon' },
  { value: 'vacation', label: 'Vacation', icon: 'PalmtreeIcon' },
  { value: 'wedding', label: 'Wedding', icon: 'RingIcon' },
  { value: 'emergency', label: 'Emergency Fund', icon: 'HeartIcon' },
  { value: 'retirement', label: 'Retirement', icon: 'PiggyBankIcon' },
  { value: 'other', label: 'Other', icon: 'TargetIcon' }
];

export const CATEGORY_COLORS: Record<string, string> = {
  home: 'text-gray-600 bg-blue-50 border-blue-200',
  car: 'text-purple-600 bg-purple-50 border-purple-200',
  education: 'text-green-600 bg-green-50 border-green-200',
  vacation: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  wedding: 'text-pink-600 bg-pink-50 border-pink-200',
  emergency: 'text-red-600 bg-red-50 border-red-200',
  retirement: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  other: 'text-gray-600 bg-gray-50 border-gray-200'
};