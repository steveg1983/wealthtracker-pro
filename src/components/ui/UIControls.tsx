import React from 'react';
import { ChevronUpIcon } from '../icons/ChevronUpIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { MaximizeIcon } from '../icons/MaximizeIcon';
import { MinimizeIcon } from '../icons/MinimizeIcon';
import { PlusIcon } from '../icons/PlusIcon';

interface ControlButtonProps {
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12'
};

const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24
};

export const CollapseButton: React.FC<ControlButtonProps> = ({ onClick, className = '', size = 'md' }) => (
  <button
    onClick={onClick}
    className={`${sizeClasses[size]} rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 ${className}`}
    aria-label="Collapse"
  >
    <MinimizeIcon size={iconSizes[size]} className="text-indigo-300" />
  </button>
);

export const ExpandButton: React.FC<ControlButtonProps> = ({ onClick, className = '', size = 'md' }) => (
  <button
    onClick={onClick}
    className={`${sizeClasses[size]} rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 ${className}`}
    aria-label="Expand"
  >
    <MaximizeIcon size={iconSizes[size]} className="text-indigo-300" />
  </button>
);

export const AddButton: React.FC<ControlButtonProps> = ({ onClick, className = '', size = 'md' }) => (
  <button
    onClick={onClick}
    className={`${sizeClasses[size]} rounded-lg bg-red-500/80 hover:bg-red-500/90 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg ${className}`}
    aria-label="Add"
  >
    <PlusIcon size={iconSizes[size]} className="text-white" />
  </button>
);

export const FloatingAddButton: React.FC<ControlButtonProps> = ({ onClick, className = '', size = 'lg' }) => (
  <button
    onClick={onClick}
    className={`fixed bottom-6 right-6 ${sizeClasses[size]} rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-xl z-50 ${className}`}
    aria-label="Add new item"
  >
    <PlusIcon size={iconSizes[size]} className="text-white" />
  </button>
);

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = true,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className={`bg-gray-800/50 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-8 h-8 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 flex items-center justify-center transition-all duration-200"
        >
          {isExpanded ? (
            <ChevronUpIcon size={16} className="text-indigo-300" />
          ) : (
            <ChevronDownIcon size={16} className="text-indigo-300" />
          )}
        </button>
      </div>
      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
};