import React, { useState } from 'react';
import { PaletteIcon } from './icons';
import ThemeCustomizer from './ThemeCustomizer';

export default function FloatingThemeButton() {
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsCustomizerOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-[var(--color-primary)] hover:bg-[var(--color-secondary)] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:ring-offset-2 group"
        title="Customize Theme"
        aria-label="Open theme customizer"
      >
        <PaletteIcon 
          size={24} 
          className="transition-transform group-hover:scale-110" 
        />
      </button>

      <ThemeCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
      />
    </>
  );
}