import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { XIcon } from '../icons';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  links: Array<{
    to: string;
    icon: React.ElementType;
    label: string;
    subItems?: Array<{
      to: string;
      icon: React.ElementType;
      label: string;
    }>;
  }>;
}

export function MobileNavigation({ isOpen, onClose, links }: MobileNavigationProps) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set());

  const toggleSection = (label: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedSections(newExpanded);
  };

  const handleLinkClick = () => {
    // Small delay to see the active state before closing
    setTimeout(onClose, 150);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 sm:hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ 
              type: 'spring',
              stiffness: 300,
              damping: 30
            }}
            className="fixed top-0 left-0 bottom-0 w-80 bg-[#d4dce8] dark:bg-gray-800 shadow-xl z-50 sm:hidden overflow-y-auto"
          >
            {/* Header */}
            <div className="bg-primary dark:bg-gray-900 p-4 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Navigation</h2>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-2 -mr-2"
                aria-label="Close navigation"
              >
                <XIcon size={24} />
              </button>
            </div>

            {/* Links */}
            <nav className="p-4 space-y-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                const isExpanded = expandedSections.has(link.label);
                const hasSubItems = link.subItems && link.subItems.length > 0;

                return (
                  <div key={link.to}>
                    {hasSubItems ? (
                      <>
                        <button
                          onClick={() => toggleSection(link.label)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                            isActive 
                              ? 'bg-primary/10 text-primary dark:text-primary-light' 
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Icon size={20} />
                          <span className="flex-1 text-left font-medium">{link.label}</span>
                          <motion.svg
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </motion.svg>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-8 mt-1 space-y-1">
                                {link.subItems?.map((subItem) => {
                                  const SubIcon = subItem.icon;
                                  const isSubActive = location.pathname === subItem.to;

                                  return (
                                    <Link
                                      key={subItem.to}
                                      to={subItem.to}
                                      onClick={handleLinkClick}
                                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                                        isSubActive 
                                          ? 'bg-primary/10 text-primary dark:text-primary-light' 
                                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                      }`}
                                    >
                                      <SubIcon size={18} />
                                      <span className="text-sm">{subItem.label}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <Link
                        to={link.to}
                        onClick={handleLinkClick}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                          isActive 
                            ? 'bg-primary/10 text-primary dark:text-primary-light font-medium' 
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="font-medium">{link.label}</span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-[#d4dce8] dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                WealthTracker © {new Date().getFullYear()}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
