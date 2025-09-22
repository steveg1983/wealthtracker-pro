import React, { useState, useRef, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useLogger } from '../services/ServiceProvider';

export interface MenuItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
  divider?: boolean;
  action?: () => void;
}

interface NavigationDropdownProps {
  item: MenuItem;
  isActive: boolean;
  activeDropdown: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onItemClick: () => void;
}

export const NavigationDropdown = memo(function NavigationDropdown({ item,
  isActive,
  activeDropdown,
  onMouseEnter,
  onMouseLeave,
  onItemClick
 }: NavigationDropdownProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('NavigationDropdown component initialized', {
      componentName: 'NavigationDropdown'
    });
  }, []);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [itemPositions, setItemPositions] = useState<number[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (dropdownRef.current && activeDropdown === item.label) {
      const positions: number[] = [];
      const items = dropdownRef.current.querySelectorAll('[data-menu-item]');
      items.forEach((menuItem) => {
        const rect = menuItem.getBoundingClientRect();
        const parentRect = dropdownRef.current!.getBoundingClientRect();
        positions.push(rect.top - parentRect.top);
      });
      setItemPositions(positions);
    }
  }, [activeDropdown, item.label]);

  return (
    <div
      className="dropdown-container relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => {
        onMouseLeave();
        setHoveredIndex(null);
      }}
    >
      {item.path ? (
        <Link
          to={item.path}
          className={`
            flex items-center px-4 py-2 text-sm font-medium rounded-lg
            transition-all duration-200 hover:scale-105
            ${isActive
              ? 'bg-secondary text-white'
              : 'bg-secondary text-white hover:bg-secondary/80'
            }
          `}
        >
          {item.icon}
          <span className="ml-2">{item.label}</span>
        </Link>
      ) : (
        <button
          className={`
            flex items-center px-4 py-2 text-sm font-medium rounded-lg
            transition-all duration-200 hover:scale-105
            ${isActive
              ? 'bg-secondary text-white'
              : 'bg-secondary text-white hover:bg-secondary/80'
            }
          `}
        >
          {item.icon}
          <span className="ml-2">{item.label}</span>
          {item.children && (
            <ChevronDownIcon className={`ml-1 w-4 h-4 transition-transform ${
              activeDropdown === item.label ? 'rotate-180' : ''
            }`} />
          )}
        </button>
      )}

      {/* Dropdown Menu */}
      {item.children && activeDropdown === item.label && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 overflow-visible"
        >
          {/* Floating Highlight */}
          <div
            className="absolute left-2 right-2 h-8 transition-all duration-200 ease-out pointer-events-none"
            style={{
              transform: hoveredIndex !== null && itemPositions[hoveredIndex]
                ? `translateY(${itemPositions[hoveredIndex] - 4}px) scale(1.02)` 
                : 'translateY(-40px) scale(0.95)',
              opacity: hoveredIndex !== null ? 1 : 0,
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
              boxShadow: hoveredIndex !== null 
                ? '0 6px 16px rgba(59, 130, 246, 0.15), 0 2px 6px rgba(59, 130, 246, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
                : 'none',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(59, 130, 246, 0.1)',
              zIndex: 0
            }}
          />
          
          {/* Menu Items */}
          {item.children.map((child, index) => {
            const itemIndex = item.children!.slice(0, index).filter(c => !c.divider).length;
            
            return (
              <React.Fragment key={index}>
                {child.divider ? (
                  <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                ) : (
                  <Link
                    to={child.path!}
                    data-menu-item
                    className="relative flex items-center px-4 py-2 text-sm transition-all duration-200 z-10"
                    style={{
                      color: hoveredIndex === itemIndex 
                        ? 'rgb(59, 130, 246)' 
                        : '',
                      transform: hoveredIndex === itemIndex 
                        ? 'translateX(2px)' 
                        : 'translateX(0)',
                    }}
                    onMouseEnter={() => setHoveredIndex(itemIndex)}
                    onClick={onItemClick}
                  >
                    <div className={`transition-all duration-200 ${hoveredIndex === itemIndex ? 'scale-110' : 'scale-100'}`}>
                      {child.icon}
                    </div>
                    <span className={`ml-3 font-medium transition-all duration-200 ${
                      hoveredIndex === itemIndex 
                        ? 'text-gray-600 dark:text-gray-500' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {child.label}
                    </span>
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
});