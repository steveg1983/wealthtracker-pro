import { memo } from 'react';
import {
  IconFilter,
  IconSortDescending,
  IconEye,
  IconEyeOff,
  IconGripVertical,
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconBell,
  IconBellOff,
  IconMaximize,
  IconMinimize,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayersLinked,
  IconLayoutGrid,
  IconLoader2,
  IconActivity,
  IconWifi,
  IconWifiOff,
  IconBulb,
  IconMoon,
  IconSun,
  IconPalette,
  IconToggleLeft,
  IconToggleRight,
  IconCircleDot,
  IconMinus,
  IconWand,
  IconVolume,
  IconVolume2,
  IconTarget,
  IconBuilding,
  IconRepeat,
  IconRefresh,
} from '@tabler/icons-react';
import { createIconComponent } from './iconUtils';

/**
 * UI and interface icons module
 * Extracted from index.tsx for better organization
 */

// Search & Filter
// SearchIcon moved to navigationIcons.tsx to avoid duplicate
export const FilterIcon = memo(createIconComponent(IconFilter, 'FilterIcon'));
export const SortIcon = memo(createIconComponent(IconSortDescending, 'SortIcon'));

// View Controls
export const EyeIcon = memo(createIconComponent(IconEye, 'EyeIcon'));
export const EyeOffIcon = memo(createIconComponent(IconEyeOff, 'EyeOffIcon'));
export const GripVerticalIcon = memo(createIconComponent(IconGripVertical, 'GripVerticalIcon'));

// Alert & Status Icons
export const AlertCircleIcon = memo(createIconComponent(IconAlertCircle, 'AlertCircleIcon'));
export const AlertTriangleIcon = memo(createIconComponent(IconAlertTriangle, 'AlertTriangleIcon'));
export const InfoIcon = memo(createIconComponent(IconInfoCircle, 'InfoIcon'));

// Notification Icons
export const BellIcon = memo(createIconComponent(IconBell, 'BellIcon'));
export const BellOffIcon = memo(createIconComponent(IconBellOff, 'BellOffIcon'));

// Window Controls
export const MaximizeIcon = memo(createIconComponent(IconMaximize, 'MaximizeIcon'));
export const MinimizeIcon = memo(createIconComponent(IconMinimize, 'MinimizeIcon'));
export const ExpandIcon = memo(createIconComponent(IconArrowsMaximize, 'ExpandIcon'));
export const ShrinkIcon = memo(createIconComponent(IconArrowsMinimize, 'ShrinkIcon'));

// Layout Icons
export const LayersIcon = memo(createIconComponent(IconLayersLinked, 'LayersIcon'));
export const GridIcon = memo(createIconComponent(IconLayoutGrid, 'GridIcon'));

// Loading & Activity
export const Loader2Icon = memo(createIconComponent(IconLoader2, 'Loader2Icon'));
export const ActivityIcon = memo(createIconComponent(IconActivity, 'ActivityIcon'));
export const LoadingIcon = memo(createIconComponent(IconRefresh, 'LoadingIcon'));

// Connection Status
export const WifiIcon = memo(createIconComponent(IconWifi, 'WifiIcon'));
export const WifiOffIcon = memo(createIconComponent(IconWifiOff, 'WifiOffIcon'));

// Theme Icons
export const MoonIcon = memo(createIconComponent(IconMoon, 'MoonIcon'));
export const SunIcon = memo(createIconComponent(IconSun, 'SunIcon'));
export const PaletteIcon = memo(createIconComponent(IconPalette, 'PaletteIcon'));

// Toggle Icons
export const ToggleLeftIcon = memo(createIconComponent(IconToggleLeft, 'ToggleLeftIcon'));
export const ToggleRightIcon = memo(createIconComponent(IconToggleRight, 'ToggleRightIcon'));

// Misc UI Icons
export const CircleDotIcon = memo(createIconComponent(IconCircleDot, 'CircleDotIcon'));
export const MinusIcon = memo(createIconComponent(IconMinus, 'MinusIcon'));
export const MagicWandIcon = memo(createIconComponent(IconWand, 'MagicWandIcon'));
export const VolumeIcon = memo(createIconComponent(IconVolume, 'VolumeIcon'));
export const LightbulbIcon = memo(createIconComponent(IconBulb, 'LightbulbIcon'));

// Additional Icons
export const GoalIcon = memo(createIconComponent(IconTarget, 'GoalIcon'));
export const TargetIcon = memo(createIconComponent(IconTarget, 'TargetIcon'));
export const BuildingIcon = memo(createIconComponent(IconBuilding, 'BuildingIcon'));
export const RepeatIcon = memo(createIconComponent(IconRepeat, 'RepeatIcon'));

// Aliases
export const Maximize2Icon = MaximizeIcon;
export const Minimize2Icon = MinimizeIcon;