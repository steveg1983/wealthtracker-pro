import { memo } from 'react';
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconX,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconCirclePlus,
  IconDownload,
  IconUpload,
  IconRefresh,
  IconCopy,
  IconDeviceFloppy,
  IconSend,
  IconLink,
  IconUnlink,
  IconScissors,
  IconHelpCircle,
  IconSparkles,
} from '@tabler/icons-react';
import { createIconComponent } from './iconUtils';

/**
 * Action and operation icons module
 * Extracted from index.tsx for better organization
 */

// Core Action Icons
export const PlusIcon = memo(createIconComponent(IconPlus, 'PlusIcon'));
export const EditIcon = memo(createIconComponent(IconPencil, 'EditIcon'));
export const DeleteIcon = memo(createIconComponent(IconTrash, 'DeleteIcon'));
export const XIcon = memo(createIconComponent(IconX, 'XIcon'));
export const CheckIcon = memo(createIconComponent(IconCheck, 'CheckIcon'));
export const CheckIcon2 = memo(createIconComponent(IconCheck, 'CheckIcon2'));
export const SaveIcon = memo(createIconComponent(IconDeviceFloppy, 'SaveIcon'));
export const SendIcon = memo(createIconComponent(IconSend, 'SendIcon'));

// Circle Action Icons
export const CheckCircleIcon = memo(createIconComponent(IconCircleCheck, 'CheckCircleIcon'));
export const XCircleIcon = memo(createIconComponent(IconCircleX, 'XCircleIcon'));
export const PlusCircleIcon = memo(createIconComponent(IconCirclePlus, 'PlusCircleIcon'));

// File Operations
export const DownloadIcon = memo(createIconComponent(IconDownload, 'DownloadIcon'));
export const UploadIcon = memo(createIconComponent(IconUpload, 'UploadIcon'));
export const CopyIcon = memo(createIconComponent(IconCopy, 'CopyIcon'));

// Sync & Refresh
export const RefreshCwIcon = memo(createIconComponent(IconRefresh, 'RefreshCwIcon'));

// Link Operations
export const LinkIcon = memo(createIconComponent(IconLink, 'LinkIcon'));
export const UnlinkIcon = memo(createIconComponent(IconUnlink, 'UnlinkIcon'));

// Other Actions
export const ScissorsIcon = memo(createIconComponent(IconScissors, 'ScissorsIcon'));

// Alert & Information Icons
// AlertCircleIcon moved to uiIcons.tsx to avoid duplicate exports
// AlertTriangleIcon moved to uiIcons.tsx to avoid duplicate exports
export const HelpCircleIcon = memo(createIconComponent(IconHelpCircle, 'HelpCircleIcon'));

// Additional Action Icons
export const SparklesIcon = memo(createIconComponent(IconSparkles, 'SparklesIcon'));



// Aliases for backward compatibility
export const TrashIcon = DeleteIcon;
export const PencilIcon = EditIcon;
export const Edit2Icon = EditIcon;
export const Trash2Icon = DeleteIcon;