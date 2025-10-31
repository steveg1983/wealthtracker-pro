import React, { useState, useEffect } from 'react';
import { PlusIcon } from './icons';
import AddTransactionModal from './AddTransactionModal';
import { QuickTransactionForm } from './QuickTransactionForm';
import { useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

interface FloatingActionButtonProps {
  className?: string;
}

export function FloatingActionButton({ className = '' }: FloatingActionButtonProps): React.JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickFormOpen, setIsQuickFormOpen] = useState(false);
  const [useQuickForm, setUseQuickForm] = useState(true); // Default to quick form
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const location = useLocation();
  const { showInfo } = useToast();
  
  // Hide FAB on certain pages where it doesn't make sense
  const hiddenPaths = ['/login', '/welcome', '/settings'];
  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path));
  
  useEffect(() => {
    if (shouldHide) return;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY, shouldHide]);
  
  // Keyboard shortcut (Cmd/Ctrl + N)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (useQuickForm) {
          setIsQuickFormOpen(true);
        } else {
          setIsModalOpen(true);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [useQuickForm]);
  
  if (shouldHide) return <></>;
  
  return (
    <>
      {/* Main FAB */}
      <button
        onClick={() => useQuickForm ? setIsQuickFormOpen(true) : setIsModalOpen(true)}
        onContextMenu={(e) => {
          e.preventDefault();
          const newMode = !useQuickForm;
          setUseQuickForm(newMode);
          showInfo(newMode ? 'Quick entry mode activated' : 'Full form mode activated');
        }}
        className={`
          fixed bottom-6 right-6 z-40
          w-14 h-14 sm:w-16 sm:h-16
          bg-primary hover:bg-secondary
          text-white
          rounded-full
          shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all duration-300 ease-out
          transform hover:scale-110
          ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}
          ${className}
        `}
        aria-label="Add new transaction (Ctrl+N)"
        title="Add new transaction (Ctrl+N)"
      >
        <PlusIcon size={24} className="sm:hidden" />
        <PlusIcon size={28} className="hidden sm:block" />
      </button>
      
      {/* Quick action tooltip on desktop */}
      <div
        className={`
          hidden lg:block
          fixed bottom-7 right-24 z-40
          bg-gray-900 text-white
          px-3 py-2 rounded-lg
          text-sm font-medium
          transition-all duration-300
          ${isVisible ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        Quick add (⌘N)
      </div>
      
      {/* Secondary actions (optional - for future expansion) */}
      {/* We could add quick expense/income buttons that appear on FAB hover/click */}
      
      {/* Quick Form (default) */}
      <QuickTransactionForm
        isOpen={isQuickFormOpen}
        onClose={() => setIsQuickFormOpen(false)}
      />
      
      {/* Full Modal (alternative) */}
      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
