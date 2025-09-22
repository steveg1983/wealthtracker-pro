import { memo } from 'react';
import {
  IconHome,
  IconSettings,
  IconSettingsCog,
  IconMenu2,
  IconSearch,
  IconChevronRight,
  IconChevronDown,
  IconChevronLeft,
  IconChevronUp,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowDown,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowsLeftRight,
  IconArrowBack,
  IconExternalLink,
} from '@tabler/icons-react';
import { createIconComponent } from './iconUtils';

/**
 * Navigation icons module
 * Extracted from index.tsx for better organization
 */

// Core Navigation Icons
export const HomeIcon = memo(createIconComponent(IconHome, 'HomeIcon'));
export const SearchIcon = memo(createIconComponent(IconSearch, 'SearchIcon'));
export const SettingsIcon = memo(createIconComponent(IconSettings, 'SettingsIcon'));
export const Settings2Icon = memo(createIconComponent(IconSettingsCog, 'Settings2Icon'));
export const MenuIcon = memo(createIconComponent(IconMenu2, 'MenuIcon'));
export const ExternalLinkIcon = memo(createIconComponent(IconExternalLink, 'ExternalLinkIcon'));

// Chevron Icons
export const ChevronRightIcon = memo(createIconComponent(IconChevronRight, 'ChevronRightIcon'));
export const ChevronDownIcon = memo(createIconComponent(IconChevronDown, 'ChevronDownIcon'));
export const ChevronLeftIcon = memo(createIconComponent(IconChevronLeft, 'ChevronLeftIcon'));
export const ChevronUpIcon = memo(createIconComponent(IconChevronUp, 'ChevronUpIcon'));

// Arrow Icons
export const ArrowLeftIcon = memo(createIconComponent(IconArrowLeft, 'ArrowLeftIcon'));
export const ArrowRightIcon = memo(createIconComponent(IconArrowRight, 'ArrowRightIcon'));
export const ArrowUpIcon = memo(createIconComponent(IconArrowUp, 'ArrowUpIcon'));
export const ArrowDownIcon = memo(createIconComponent(IconArrowDown, 'ArrowDownIcon'));
export const ArrowUpRightIcon = memo(createIconComponent(IconArrowUpRight, 'ArrowUpRightIcon'));
export const ArrowDownRightIcon = memo(createIconComponent(IconArrowDownRight, 'ArrowDownRightIcon'));
export const ArrowRightLeftIcon = memo(createIconComponent(IconArrowsLeftRight, 'ArrowRightLeftIcon'));
export const UndoIcon = memo(createIconComponent(IconArrowBack, 'UndoIcon'));