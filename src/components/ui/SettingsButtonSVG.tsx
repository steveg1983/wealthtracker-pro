import React from 'react';
import { SettingsIcon } from '../icons/SettingsIcon';

interface SettingsButtonSVGProps {
  onClick: () => void;
  size?: number;
}

export const SettingsButtonSVG: React.FC<SettingsButtonSVGProps> = ({ onClick, size = 40 }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'pointer' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Drop shadow filter */}
      <defs>
        <filter id="buttonShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feFlood floodColor="#000000" floodOpacity="0.1"/>
          <feComposite in2="offsetblur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Outer border */}
      <rect
        x="0"
        y="0"
        width="40"
        height="40"
        rx="8"
        ry="8"
        fill="#8FA5C8"
        filter="url(#buttonShadow)"
      />
      
      {/* Inner button */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="6"
        ry="6"
        fill={isHovered ? "#5A729A" : "#6B86B3"}
        style={{ transition: 'fill 0.2s' }}
      />
      
      {/* Settings icon */}
      <g transform="translate(20, 20)">
        <SettingsIcon size={20} color="white" style={{ transform: 'translate(-10px, -10px)' }} />
      </g>
    </svg>
  );
};