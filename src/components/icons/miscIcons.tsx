/**
 * Miscellaneous Icons
 * Additional icons from Tabler icons library
 */

import React, { useEffect, memo } from 'react';
import {
  IconDatabase,
  IconTags,
  IconTag,
  IconHash,
  IconAdjustments,
  IconCalendar,
  IconClock,
  IconCalendarEvent,
  IconHistory,
  IconUser,
  IconUsers,
  IconUserCircle,
  IconLogin,
  IconLogout,
  IconLock,
  IconLockOpen,
  IconShield,
  IconKey,
  IconKeyboard,
  IconFileText,
  IconFolder,
  IconArchive,
  IconDeviceDesktop,
  IconWorld,
  IconMail,
  IconPhone,
  IconMapPin,
  IconCar,
  IconSchool,
  IconStar,
  IconAward,
  IconCalculator,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlayerPause,
  IconGitMerge,
  IconGitBranch,
  IconSelectAll,
  IconDeselect,
  IconTool,
  IconFileTypePdf,
  IconFingerprint,
  IconCamera,
  IconBold,
  IconItalic,
  IconList,
  IconQuote,
  IconPhoto,
  IconCode,
  IconPaperclip,
  IconCloud,
  IconCloudOff,
  IconBolt,
  IconBrandChrome,
  IconCrown,
  IconPackage,
  IconHeart,
  IconPill,
  IconBulb,
  IconSun,
  IconCircleDot,
  IconArrowsSort,
  IconTrophy,
} from '@tabler/icons-react';

import { createIconComponent } from './iconUtils';
import { logger } from '../../services/loggingService';

// Create icon components with memoization
export const DatabaseIcon = memo(createIconComponent(IconDatabase, 'DatabaseIcon'));
export const TagIcon = memo(createIconComponent(IconTag, 'TagIcon'));
export const HashIcon = memo(createIconComponent(IconHash, 'HashIcon'));
export const FolderIcon = memo(createIconComponent(IconFolder, 'FolderIcon'));
export const ArchiveIcon = memo(createIconComponent(IconArchive, 'ArchiveIcon'));
export const FileTextIcon = memo(createIconComponent(IconFileText, 'FileTextIcon'));
export const CalendarIcon = memo(createIconComponent(IconCalendar, 'CalendarIcon'));
export const ClockIcon = memo(createIconComponent(IconClock, 'ClockIcon'));
export const UserIcon = memo(createIconComponent(IconUser, 'UserIcon'));
export const UsersIcon = memo(createIconComponent(IconUsers, 'UsersIcon'));
export const LockIcon = memo(createIconComponent(IconLock, 'LockIcon'));
export const UnlockIcon = memo(createIconComponent(IconLockOpen, 'UnlockIcon'));
export const ShieldIcon = memo(createIconComponent(IconShield, 'ShieldIcon'));
export const KeyIcon = memo(createIconComponent(IconKey, 'KeyIcon'));
export const KeyboardIcon = memo(createIconComponent(IconKeyboard, 'KeyboardIcon'));
export const FingerprintIcon = memo(createIconComponent(IconFingerprint, 'FingerprintIcon'));
export const MonitorIcon = memo(createIconComponent(IconDeviceDesktop, 'MonitorIcon'));
export const ComputerIcon = memo(createIconComponent(IconDeviceDesktop, 'ComputerIcon'));
export const PhoneIcon = memo(createIconComponent(IconPhone, 'PhoneIcon'));
export const CameraIcon = memo(createIconComponent(IconCamera, 'CameraIcon'));
export const PalmtreeIcon = memo(createIconComponent(IconSun, 'PalmtreeIcon'));
export const RingIcon = memo(createIconComponent(IconCircleDot, 'RingIcon'));
export const GraduationCapIcon = memo(createIconComponent(IconSchool, 'GraduationCapIcon'));
export const CarIcon = memo(createIconComponent(IconCar, 'CarIcon'));
export const MapPinIcon = memo(createIconComponent(IconMapPin, 'MapPinIcon'));
export const GlobeIcon = memo(createIconComponent(IconWorld, 'GlobeIcon'));
export const StarIcon = memo(createIconComponent(IconStar, 'StarIcon'));
export const CalculatorIcon = memo(createIconComponent(IconCalculator, 'CalculatorIcon'));
export const PlayIcon = memo(createIconComponent(IconPlayerPlay, 'PlayIcon'));
export const StopIcon = memo(createIconComponent(IconPlayerStop, 'StopIcon'));
export const PauseIcon = memo(createIconComponent(IconPlayerPause, 'PauseIcon'));
export const MergeIcon = memo(createIconComponent(IconGitMerge, 'MergeIcon'));
export const GitBranchIcon = memo(createIconComponent(IconGitBranch, 'GitBranchIcon'));
export const SelectAllIcon = memo(createIconComponent(IconSelectAll, 'SelectAllIcon'));
export const DeselectAllIcon = memo(createIconComponent(IconDeselect, 'DeselectAllIcon'));
export const WrenchIcon = memo(createIconComponent(IconTool, 'WrenchIcon'));
export const PdfIcon = memo(createIconComponent(IconFileTypePdf, 'PdfIcon'));
export const PaperclipIcon = memo(createIconComponent(IconPaperclip, 'PaperclipIcon'));
export const MailIcon = memo(createIconComponent(IconMail, 'MailIcon'));
export const BoldIcon = memo(createIconComponent(IconBold, 'BoldIcon'));
export const ItalicIcon = memo(createIconComponent(IconItalic, 'ItalicIcon'));
export const ListIcon = memo(createIconComponent(IconList, 'ListIcon'));
export const QuoteIcon = memo(createIconComponent(IconQuote, 'QuoteIcon'));
export const ImageIcon = memo(createIconComponent(IconPhoto, 'ImageIcon'));
export const CodeIcon = memo(createIconComponent(IconCode, 'CodeIcon'));
export const CloudIcon = memo(createIconComponent(IconCloud, 'CloudIcon'));
export const CloudOffIcon = memo(createIconComponent(IconCloudOff, 'CloudOffIcon'));
export const ZapIcon = memo(createIconComponent(IconBolt, 'ZapIcon'));
export const ChromeIcon = memo(createIconComponent(IconBrandChrome, 'ChromeIcon'));
export const CrownIcon = memo(createIconComponent(IconCrown, 'CrownIcon'));
export const PackageIcon = memo(createIconComponent(IconPackage, 'PackageIcon'));
export const HeartIcon = memo(createIconComponent(IconHeart, 'HeartIcon'));
export const PillIcon = memo(createIconComponent(IconPill, 'PillIcon'));
export const LeafIcon = memo(createIconComponent(IconBulb, 'LeafIcon'));
export const CompareIcon = memo(createIconComponent(IconArrowsSort, 'CompareIcon'));
export const TrophyIcon = memo(createIconComponent(IconTrophy, 'TrophyIcon'));
// ActivityIcon and LoadingIcon moved to uiIcons.tsx to avoid duplicate exports