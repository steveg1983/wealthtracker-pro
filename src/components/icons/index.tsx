/**
 * Professional Icon System Export
 * Migrated to Tabler Icons for enterprise-grade appearance
 * This file provides backward compatibility during migration
 */

import React from 'react';
import type { Icon as TablerIconComponent } from '@tabler/icons-react';
import { logger } from '../../services/loggingService';
import {
  IconHome,
  IconSettings,
  IconSettingsCog,
  IconWallet,
  IconChartBar,
  IconTarget,
  IconTrendingUp,
  IconTrendingDown,
  IconChartPie,
  IconFileText,
  IconBuildingBank,
  IconDatabase,
  IconTag,
  IconHash,
  IconPlus,
  IconPencil,
  IconTrash,
  IconX,
  IconCheck,
  IconCircleCheck,
  IconDownload,
  IconUpload,
  IconRefresh,
  IconSearch,
  IconFilter,
  IconSortDescending,
  IconChevronRight,
  IconChevronDown,
  IconChevronLeft,
  IconChevronUp,
  IconMenu2,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconGripVertical,
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconCircleX,
  IconBell,
  IconBellOff,
  IconCreditCard,
  IconCash,
  IconReceipt,
  IconPigMoney,
  IconCurrencyDollar,
  IconChartLine,
  IconCalendar,
  IconClock,
  IconUser,
  IconUsers,
  IconLock,
  IconLockOpen,
  IconShield,
  IconKey,
  IconKeyboard,
  IconBriefcase,
  IconBuilding,
  IconFolder,
  IconArchive,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
  IconWorld,
  IconLink,
  IconMail,
  IconPhone,
  IconMapPin,
  IconCar,
  IconSchool,
  IconStar,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowDown,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMaximize,
  IconMinimize,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCalculator,
  IconMinus,
  IconDeviceFloppy,
  IconLayersLinked,
  IconLayoutGrid,
  IconWand,
  IconArrowBack,
  IconVolume,
  IconCopy,
  IconPlayerPlay,
  IconPlayerStop,
  IconGitMerge,
  IconSelectAll,
  IconDeselect,
  IconUnlink,
  IconTool,
  IconActivity,
  IconWifi,
  IconWifiOff,
  IconBulb,
  IconFileTypePdf,
  IconFingerprint,
  IconCamera,
  IconSend,
  IconBold,
  IconItalic,
  IconList,
  IconQuote,
  IconPhoto,
  IconCode,
  IconPaperclip,
  IconToggleLeft,
  IconToggleRight,
  IconCircleDot,
  IconArrowsLeftRight,
  IconCirclePlus,
  IconPalette,
  // Added for lucide consolidation
  IconCloud,
  IconCloudOff,
  IconBolt,
  IconLoader2,
  IconGitBranch,
  IconBrandChrome,
  IconCrown,
  IconCurrencyPound,
  IconPackage,
  IconHeart,
  IconPill,
  IconPlayerPause,
  IconScissors,
} from '@tabler/icons-react';

// Common props interface
export interface IconProps {
  size?: number;
  color?: string;
  hoverColor?: string;
  onClick?: () => void;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
  'data-testid'?: string;
}

// Log to verify new icons are loaded
// Use centralized logger to avoid noisy console in production
logger.debug('[PROFESSIONAL ICONS] Loading professional icon system');

// Professional icon wrapper for consistent styling
const createIconComponent = (
  TablerIcon: TablerIconComponent,
  displayName: string
) => {
  const IconComponent: React.FC<IconProps> = ({
    size = 20,
    color = 'currentColor',
    className = '',
    onClick,
    title,
    style,
    strokeWidth = 2,
    'data-testid': dataTestId,
  }) => {
    return (
      <TablerIcon
        size={size}
        color={color}
        stroke={strokeWidth}
        className={`transition-colors duration-200 ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
        onClick={onClick}
        style={style}
        aria-label={title}
        data-testid={dataTestId}
      />
    );
  };
  IconComponent.displayName = displayName;
  return IconComponent;
};

// Export base interface (for backward compatibility)
export const IconBase: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

// Core Navigation Icons
export const HomeIcon = createIconComponent(IconHome, 'HomeIcon');
export const SettingsIcon = createIconComponent(IconSettings, 'SettingsIcon');
export const Settings2Icon = createIconComponent(IconSettingsCog, 'Settings2Icon');
export const WalletIcon = createIconComponent(IconWallet, 'WalletIcon');
export const CreditCardIcon = createIconComponent(IconCreditCard, 'CreditCardIcon');
export const Building2Icon = createIconComponent(IconBuilding, 'Building2Icon');
export const LandmarkIcon = createIconComponent(IconBuildingBank, 'LandmarkIcon');

// Chart & Analytics Icons
export const BarChart3Icon = createIconComponent(IconChartBar, 'BarChart3Icon');
export const LineChartIcon = createIconComponent(IconChartLine, 'LineChartIcon');
export const PieChartIcon = createIconComponent(IconChartPie, 'PieChartIcon');
export const TrendingUpIcon = createIconComponent(IconTrendingUp, 'TrendingUpIcon');
export const TrendingDownIcon = createIconComponent(IconTrendingDown, 'TrendingDownIcon');

// Action Icons
export const PlusIcon = createIconComponent(IconPlus, 'PlusIcon');
export const EditIcon = createIconComponent(IconPencil, 'EditIcon');
export const DeleteIcon = createIconComponent(IconTrash, 'DeleteIcon');
export const XIcon = createIconComponent(IconX, 'XIcon');
export const CheckIcon = createIconComponent(IconCheck, 'CheckIcon');
export const CheckIcon2 = createIconComponent(IconCheck, 'CheckIcon2');
export const CheckCircleIcon = createIconComponent(IconCircleCheck, 'CheckCircleIcon');
export const XCircleIcon = createIconComponent(IconCircleX, 'XCircleIcon');

// Navigation Icons
export const ChevronRightIcon = createIconComponent(IconChevronRight, 'ChevronRightIcon');
export const ChevronDownIcon = createIconComponent(IconChevronDown, 'ChevronDownIcon');
export const ChevronLeftIcon = createIconComponent(IconChevronLeft, 'ChevronLeftIcon');
export const ChevronUpIcon = createIconComponent(IconChevronUp, 'ChevronUpIcon');
export const ArrowLeftIcon = createIconComponent(IconArrowLeft, 'ArrowLeftIcon');
export const ArrowRightIcon = createIconComponent(IconArrowRight, 'ArrowRightIcon');
export const ArrowUpIcon = createIconComponent(IconArrowUp, 'ArrowUpIcon');
export const ArrowDownIcon = createIconComponent(IconArrowDown, 'ArrowDownIcon');
export const ArrowUpRightIcon = createIconComponent(IconArrowUpRight, 'ArrowUpRightIcon');
export const ArrowDownRightIcon = createIconComponent(IconArrowDownRight, 'ArrowDownRightIcon');
export const ArrowRightLeftIcon = createIconComponent(IconArrowsLeftRight, 'ArrowRightLeftIcon');

// Status Icons
export const AlertCircleIcon = createIconComponent(IconAlertCircle, 'AlertCircleIcon');
export const AlertTriangleIcon = createIconComponent(IconAlertTriangle, 'AlertTriangleIcon');
export const InfoIcon = createIconComponent(IconInfoCircle, 'InfoIcon');

// Financial Icons
export const BanknoteIcon = createIconComponent(IconCash, 'BanknoteIcon');
export const PiggyBankIcon = createIconComponent(IconPigMoney, 'PiggyBankIcon');
export const DollarSignIcon = createIconComponent(IconCurrencyDollar, 'DollarSignIcon');

// UI Icons
export const MenuIcon = createIconComponent(IconMenu2, 'MenuIcon');
export const SearchIcon = createIconComponent(IconSearch, 'SearchIcon');
export const FilterIcon = createIconComponent(IconFilter, 'FilterIcon');
export const EyeIcon = createIconComponent(IconEye, 'EyeIcon');
export const EyeOffIcon = createIconComponent(IconEyeOff, 'EyeOffIcon');
export const DownloadIcon = createIconComponent(IconDownload, 'DownloadIcon');
export const UploadIcon = createIconComponent(IconUpload, 'UploadIcon');
export const RefreshCwIcon = createIconComponent(IconRefresh, 'RefreshCwIcon');
export const CopyIcon = createIconComponent(IconCopy, 'CopyIcon');
export const LinkIcon = createIconComponent(IconLink, 'LinkIcon');
export const GripVerticalIcon = createIconComponent(IconGripVertical, 'GripVerticalIcon');

// Data Icons
export const DatabaseIcon = createIconComponent(IconDatabase, 'DatabaseIcon');
export const TagIcon = createIconComponent(IconTag, 'TagIcon');
export const HashIcon = createIconComponent(IconHash, 'HashIcon');
export const FolderIcon = createIconComponent(IconFolder, 'FolderIcon');
export const ArchiveIcon = createIconComponent(IconArchive, 'ArchiveIcon');
export const FileTextIcon = createIconComponent(IconFileText, 'FileTextIcon');

// Goal & Target Icons
export const TargetIcon = createIconComponent(IconTarget, 'TargetIcon');
export const GoalIcon = createIconComponent(IconTarget, 'GoalIcon');

// Time Icons
export const CalendarIcon = createIconComponent(IconCalendar, 'CalendarIcon');
export const ClockIcon = createIconComponent(IconClock, 'ClockIcon');

// User Icons
export const UserIcon = createIconComponent(IconUser, 'UserIcon');
export const UsersIcon = createIconComponent(IconUsers, 'UsersIcon');

// Security Icons
export const LockIcon = createIconComponent(IconLock, 'LockIcon');
export const UnlockIcon = createIconComponent(IconLockOpen, 'UnlockIcon');
export const ShieldIcon = createIconComponent(IconShield, 'ShieldIcon');
export const KeyIcon = createIconComponent(IconKey, 'KeyIcon');
export const KeyboardIcon = createIconComponent(IconKeyboard, 'KeyboardIcon');
export const FingerprintIcon = createIconComponent(IconFingerprint, 'FingerprintIcon');

// Device Icons
export const MonitorIcon = createIconComponent(IconDeviceDesktop, 'MonitorIcon');
export const ComputerIcon = createIconComponent(IconDeviceDesktop, 'ComputerIcon');
export const PhoneIcon = createIconComponent(IconPhone, 'PhoneIcon');
export const CameraIcon = createIconComponent(IconCamera, 'CameraIcon');

// Theme Icons
export const MoonIcon = createIconComponent(IconMoon, 'MoonIcon');
export const SunIcon = createIconComponent(IconSun, 'SunIcon');
export const PalmtreeIcon = createIconComponent(IconSun, 'PalmtreeIcon'); // Using Sun as vacation/retirement icon
export const RingIcon = createIconComponent(IconCircleDot, 'RingIcon'); // Using CircleDot as wedding ring icon
export const PaletteIcon = createIconComponent(IconPalette, 'PaletteIcon');

// Communication Icons
export const BellIcon = createIconComponent(IconBell, 'BellIcon');
export const BellOffIcon = createIconComponent(IconBellOff, 'BellOffIcon');
export const MailIcon = createIconComponent(IconMail, 'MailIcon');
export const SendIcon = createIconComponent(IconSend, 'SendIcon');

// Professional Icons
export const BriefcaseIcon = createIconComponent(IconBriefcase, 'BriefcaseIcon');
export const BuildingIcon = createIconComponent(IconBuilding, 'BuildingIcon');
export const BankIcon = createIconComponent(IconBuildingBank, 'BankIcon');
export const GraduationCapIcon = createIconComponent(IconSchool, 'GraduationCapIcon');
export const CarIcon = createIconComponent(IconCar, 'CarIcon');
export const MapPinIcon = createIconComponent(IconMapPin, 'MapPinIcon');
export const GlobeIcon = createIconComponent(IconWorld, 'GlobeIcon');
export const StarIcon = createIconComponent(IconStar, 'StarIcon');

// Utility Icons
export const CalculatorIcon = createIconComponent(IconCalculator, 'CalculatorIcon');
export const MinusIcon = createIconComponent(IconMinus, 'MinusIcon');
export const SaveIcon = createIconComponent(IconDeviceFloppy, 'SaveIcon');
export const LayersIcon = createIconComponent(IconLayersLinked, 'LayersIcon');
export const GridIcon = createIconComponent(IconLayoutGrid, 'GridIcon');
export const MagicWandIcon = createIconComponent(IconWand, 'MagicWandIcon');
export const VolumeIcon = createIconComponent(IconVolume, 'VolumeIcon');
export const PlayIcon = createIconComponent(IconPlayerPlay, 'PlayIcon');
export const StopIcon = createIconComponent(IconPlayerStop, 'StopIcon');
export const MergeIcon = createIconComponent(IconGitMerge, 'MergeIcon');
export const SelectAllIcon = createIconComponent(IconSelectAll, 'SelectAllIcon');
export const DeselectAllIcon = createIconComponent(IconDeselect, 'DeselectAllIcon');
export const UnlinkIcon = createIconComponent(IconUnlink, 'UnlinkIcon');
export const WrenchIcon = createIconComponent(IconTool, 'WrenchIcon');
export const UndoIcon = createIconComponent(IconArrowBack, 'UndoIcon');
export const ScissorsIcon = createIconComponent(IconScissors, 'ScissorsIcon');

// Status Icons
export const ActivityIcon = createIconComponent(IconActivity, 'ActivityIcon');
export const WifiIcon = createIconComponent(IconWifi, 'WifiIcon');
export const WifiOffIcon = createIconComponent(IconWifiOff, 'WifiOffIcon');
export const LoadingIcon = createIconComponent(IconRefresh, 'LoadingIcon');
export const LightbulbIcon = createIconComponent(IconBulb, 'LightbulbIcon');

// Document Icons
export const PdfIcon = createIconComponent(IconFileTypePdf, 'PdfIcon');
export const PaperclipIcon = createIconComponent(IconPaperclip, 'PaperclipIcon');
export const ReceiptIcon = createIconComponent(IconReceipt, 'ReceiptIcon');

// Editor Icons
export const BoldIcon = createIconComponent(IconBold, 'BoldIcon');
export const ItalicIcon = createIconComponent(IconItalic, 'ItalicIcon');
export const ListIcon = createIconComponent(IconList, 'ListIcon');
export const QuoteIcon = createIconComponent(IconQuote, 'QuoteIcon');
export const ImageIcon = createIconComponent(IconPhoto, 'ImageIcon');
export const CodeIcon = createIconComponent(IconCode, 'CodeIcon');

// Toggle Icons
export const ToggleLeftIcon = createIconComponent(IconToggleLeft, 'ToggleLeftIcon');
export const ToggleRightIcon = createIconComponent(IconToggleRight, 'ToggleRightIcon');

// Cloud/Sync & Misc wrappers to align with lucide usage
export const CloudIcon = createIconComponent(IconCloud, 'CloudIcon');
export const CloudOffIcon = createIconComponent(IconCloudOff, 'CloudOffIcon');
export const ZapIcon = createIconComponent(IconBolt, 'ZapIcon');
export const Loader2Icon = createIconComponent(IconLoader2, 'Loader2Icon');
export const GitBranchIcon = createIconComponent(IconGitBranch, 'GitBranchIcon');
export const ChromeIcon = createIconComponent(IconBrandChrome, 'ChromeIcon');
export const ExternalLinkIcon = createIconComponent(IconExternalLink, 'ExternalLinkIcon');
export const CrownIcon = createIconComponent(IconCrown, 'CrownIcon');
export const PoundSterlingIcon = createIconComponent(IconCurrencyPound, 'PoundSterlingIcon');
export const PackageIcon = createIconComponent(IconPackage, 'PackageIcon');
export const HeartIcon = createIconComponent(IconHeart, 'HeartIcon');
export const PillIcon = createIconComponent(IconPill, 'PillIcon');
export const PauseIcon = createIconComponent(IconPlayerPause, 'PauseIcon');

// Window Icons
export const MaximizeIcon = createIconComponent(IconMaximize, 'MaximizeIcon');
export const MinimizeIcon = createIconComponent(IconMinimize, 'MinimizeIcon');
export const ExpandIcon = createIconComponent(IconArrowsMaximize, 'ExpandIcon');
export const ShrinkIcon = createIconComponent(IconArrowsMinimize, 'ShrinkIcon');

// Special Icons
export const CircleDotIcon = createIconComponent(IconCircleDot, 'CircleDotIcon');
export const PlusCircleIcon = createIconComponent(IconCirclePlus, 'PlusCircleIcon');
export const RepeatIcon = createIconComponent(IconRefresh, 'RepeatIcon');
export const SortIcon = createIconComponent(IconSortDescending, 'SortIcon');
export const LeafIcon = createIconComponent(IconBulb, 'LeafIcon'); // Using bulb as placeholder

// Export aliases for backward compatibility
export const TrashIcon = DeleteIcon;
export const PencilIcon = EditIcon;
export const Maximize2Icon = MaximizeIcon;
export const Minimize2Icon = MinimizeIcon;
export const Edit2Icon = EditIcon;
export const Trash2Icon = DeleteIcon;
export const Tag = TagIcon;
export const Check = CheckIcon;
export const BarChart3 = BarChart3Icon;
export const PiggyBank = PiggyBankIcon;
export const Wallet = WalletIcon;
export const Home = HomeIcon;
export const Search = SearchIcon;
export const Calendar = CalendarIcon;
export const FileText = FileTextIcon;
export const Target = TargetIcon;
export const Link = LinkIcon;
export const Clock = ClockIcon;
export const Database = DatabaseIcon;
export const Download = DownloadIcon;
export const Eye = EyeIcon;
export const EyeOff = EyeOffIcon;
export const Filter = FilterIcon;
export const Globe = GlobeIcon;
export const Goal = GoalIcon;
export const GripVertical = GripVerticalIcon;
export const Info = InfoIcon;
export const Landmark = LandmarkIcon;
export const LineChart = LineChartIcon;
export const Menu = MenuIcon;
export const Monitor = MonitorIcon;
export const Moon = MoonIcon;
export const Palette = PaletteIcon;
export const PieChart = PieChartIcon;
export const RefreshCw = RefreshCwIcon;
export const Repeat = RepeatIcon;
export const Settings2 = Settings2Icon;
export const Sun = SunIcon;
export const Upload = UploadIcon;
export const XCircle = XCircleIcon;
export const Calculator = CalculatorIcon;
export const AlertTriangle = AlertTriangleIcon;
export const ArrowRight = ArrowRightIcon;
export const ArrowRightLeft = ArrowRightLeftIcon;
export const ArrowUpRight = ArrowUpRightIcon;
export const ArrowDownRight = ArrowDownRightIcon;
export const Banknote = BanknoteIcon;
export const ChevronUp = ChevronUpIcon;
export const PlusCircle = PlusCircleIcon;
export const Settings = SettingsIcon;
export const X = XIcon;
export const ArrowLeft = ArrowLeftIcon;
export const Maximize2 = MaximizeIcon;
export const ChevronRight = ChevronRightIcon;
export const TrendingUp = TrendingUpIcon;
export const TrendingDown = TrendingDownIcon;
export const AlertCircle = AlertCircleIcon;
export const CheckCircle = CheckCircleIcon;
export const CreditCard = CreditCardIcon;
export const Hash = HashIcon;
export const Lock = LockIcon;
export const Unlock = UnlockIcon;
export const WifiOff = WifiOffIcon;
export const Computer = ComputerIcon;
export const Keyboard = ComputerIcon; // Using Computer as placeholder
export const Minus = MinusIcon;
export const DollarSign = DollarSignIcon;
export const Save = SaveIcon;
export const Layers = LayersIcon;
export const Grid = GridIcon;
export const MagicWand = MagicWandIcon;
export const Bell = BellIcon;
export const Volume = VolumeIcon;
export const BellOff = BellOffIcon;
export const Copy = CopyIcon;
export const Play = PlayIcon;
export const Stop = StopIcon;
export const Merge = MergeIcon;
export const SelectAll = SelectAllIcon;
export const DeselectAll = DeselectAllIcon;
export const Unlink = UnlinkIcon;
export const Wrench = WrenchIcon;
export const Folder = FolderIcon;
export const Undo = UndoIcon;
export const Wifi = WifiIcon;
export const Pdf = PdfIcon;
export const Key = KeyIcon;
export const Phone = PhoneIcon;
export const Leaf = LeafIcon;
export const Shield = ShieldIcon;
export const Fingerprint = FingerprintIcon;
export const User = UserIcon;
export const Users = UsersIcon;
export const Loading = LoadingIcon;
export const Camera = CameraIcon;
export const MapPin = MapPinIcon;
export const Car = CarIcon;
export const Briefcase = BriefcaseIcon;
export const Send = SendIcon;
export const GraduationCap = GraduationCapIcon;
export const Building = BuildingIcon;
export const Sort = SortIcon;
export const Star = StarIcon;
export const SparklesIcon = StarIcon; // Alias for compatibility
export const BookOpenIcon = FileTextIcon; // Alias for compatibility
export const ChartBarIcon = BarChart3Icon; // Alias for compatibility
export const Mail = MailIcon;
export const Bold = BoldIcon;
export const Italic = ItalicIcon;
export const List = ListIcon;
export const Quote = QuoteIcon;
export const Image = ImageIcon;
export const Code = CodeIcon;
export const Bank = BankIcon;
export const Paperclip = PaperclipIcon;
export const ToggleLeft = ToggleLeftIcon;
export const ToggleRight = ToggleRightIcon;

// Export default icons for components using default imports
export default {
  ActivityIcon,
  WifiIcon,
  LeafIcon,
  ShieldIcon,
  FingerprintIcon,
  UserIcon,
  UsersIcon,
  LoadingIcon,
  CameraIcon,
  MapPinIcon,
  CarIcon,
  BriefcaseIcon,
  SendIcon,
  GraduationCapIcon,
  BuildingIcon,
  SortIcon,
  StarIcon,
  MailIcon,
  BankIcon,
  PdfIcon,
};

// IconButton component for backward compatibility
export const IconButton: React.FC<{
  icon: React.ComponentType<IconProps>;
  onClick?: () => void;
  className?: string;
  title?: string;
  size?: number;
}> = ({ icon: Icon, onClick, className = '', title, size = 20 }) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
      title={title}
      aria-label={title}
    >
      <Icon size={size} />
    </button>
  );
};

// Force cache bust - Mon Aug 25 23:17:00 +03 2025
