import React from 'react';
import { SettingsIcon } from '../icons/SettingsIcon';

interface SettingsButtonProps {
  onClick: () => void;
  size?: number;
}

export const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick, size = 40 }) => {
  return (
    <div 
      className="inline-block cursor-pointer"
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
      }}
    >
      {/* Outer border layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#8FA5C8',
          borderRadius: '8px',
          width: '100%',
          height: '100%',
        }}
      />
      
      {/* Inner button layer */}
      <div
        style={{
          position: 'absolute',
          inset: '2px',
          backgroundColor: '#6B86B3',
          borderRadius: '6px',
          width: 'calc(100% - 4px)',
          height: 'calc(100% - 4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
        }}
        className="hover:bg-[#5A729A]"
      >
        <SettingsIcon size={20} color="white" />
      </div>
      
      {/* Subtle shadow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};